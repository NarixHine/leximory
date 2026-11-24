import { z } from 'zod'
import { serializeWord } from './word-format'
import {
    extractedArticleSchema,
    articleImportSchema,
    ebookUploadQuerySchema,
    resourceID,
    savedWordSchema,
    textSchema,
    vocabularyEditSchema,
} from '@repo/api'
import { maxArticleLength } from '@repo/env/content'
import { readEbookUpload, type EbookStaging, type EbookUpload } from './ebook-upload'
import { canWriteLibrary } from '@repo/service/access'
import type { MobileSubject } from '@repo/schema/mobile'
import { MobileError } from './errors'
import { checkedResponse, jsonBody, query, type MobileContext, type MobileOperation } from './http'
import { createCatalog, type CatalogStore, type LibraryRow } from './catalog'
import { isValidEmoji } from '@/lib/utils'

export type WordFields = z.infer<typeof vocabularyEditSchema>
export interface AuthoringStore {
    extract?(url: string): Promise<{ title: string; content: string }>
    words(
        libraryId: string,
        cursor: string | null,
    ): Promise<{ items: z.infer<typeof savedWordSchema>[]; nextCursor: string | null }>
    word(id: string): Promise<{
        id: string
        libraryId: string
        fields: WordFields
        createdAt?: string | null
        protected?: boolean
    } | null>
    updateWord(id: string, libraryId: string, fields: WordFields): Promise<void>
    article(
        subject: MobileSubject,
        library: LibraryRow,
        input: z.infer<typeof articleImportSchema>,
    ): Promise<z.infer<typeof textSchema>>
    ebook(
        library: LibraryRow,
        input: { title: string; upload: EbookUpload; requestId: string | undefined },
    ): Promise<{ text: z.infer<typeof textSchema>; created: boolean }>
    chooseEbookEmoji(
        subject: MobileSubject,
        input: { title: string; filename: string },
        signal: AbortSignal,
    ): Promise<string>
    setEbookEmoji(id: string, emoji: string): Promise<void>
}
const vocabularyPageSchema = z.object({ items: z.array(savedWordSchema), nextCursor: z.string().nullable() }).strict()
const articlePreviewInput = z.object({ url: z.url().max(2048) }).strict()

export function createAuthoringOperations(dependencies: {
    catalog: CatalogStore
    authoring: AuthoringStore
    staging?: EbookStaging
}) {
    const catalog = createCatalog(dependencies.catalog)
    const store = dependencies.authoring

    async function authorizedWord({ subject, params, signal }: MobileContext) {
        const id = resourceID.parse(params.wordId)
        const word = await store.word(id)
        if (!word) throw new MobileError('inaccessible')
        if (word.id !== id) throw new MobileError('service_unavailable')
        const library = await catalog.authorizedLibrary(subject, word.libraryId, signal)
        return { word, library }
    }

    async function writableContentLibrary({ subject, params, signal }: MobileContext) {
        return catalog.authorizedContentLibrary(subject, resourceID.parse(params.libraryId), signal)
    }

    const vocabularyList: MobileOperation = async ({ request, subject, params, signal }) => {
        const library = await catalog.authorizedLibrary(subject, resourceID.parse(params.libraryId), signal)
        const { cursor } = query(request, ['cursor'])
        if (cursor && !/^\d{1,7}$/.test(cursor)) throw new MobileError('invalid_input')
        const page = checkedResponse(vocabularyPageSchema, await store.words(library.id, cursor ?? null))
        if (page.items.some((word) => word.libraryId !== library.id)) throw new MobileError('service_unavailable')
        return page
    }

    const savedWord: MobileOperation = async (context) => {
        const { word } = await authorizedWord(context)
        return checkedResponse(savedWordSchema, word)
    }

    const editWord: MobileOperation = async (context) => {
        const { word, library } = await authorizedWord(context)
        if (!canWriteLibrary(context.subject, library) || word.protected) throw new MobileError('inaccessible')
        const fields = vocabularyEditSchema.parse(await jsonBody(context.request, 320000, context.signal))
        serializeWord(fields)
        await store.updateWord(word.id, word.libraryId, fields)
        return checkedResponse(savedWordSchema, { ...word, fields })
    }

    const extractArticle: MobileOperation = async (context) => {
        const library = await writableContentLibrary(context)
        const { url } = articlePreviewInput.parse(await jsonBody(context.request, 16384, context.signal))
        if (!store.extract) throw new MobileError('service_unavailable')
        const article = checkedResponse(extractedArticleSchema, await store.extract(url))
        if (article.content.length > maxArticleLength(library.lang)) throw new MobileError('invalid_input')
        return article
    }

    const importArticle: MobileOperation = async (context) => {
        const library = await writableContentLibrary(context)
        // JSON escapes can use six bytes for each permitted UTF-16 code unit.
        const input = articleImportSchema.parse(
            await jsonBody(context.request, maxArticleLength(library.lang) * 6 + 8192, context.signal),
        )
        if (input.content.length > maxArticleLength(library.lang)) throw new MobileError('invalid_input')
        return checkedResponse(textSchema, await store.article(context.subject, library, input))
    }

    const uploadEbook: MobileOperation = async (context) => {
        const library = await writableContentLibrary(context)
        const { title, filename, requestId, uploadId } = ebookUploadQuerySchema.parse(
            query(context.request, ['title', 'filename', 'requestId', 'uploadId']),
        )
        let upload: EbookUpload
        if (uploadId) {
            if (!requestId || !dependencies.staging) throw new MobileError('invalid_input')
            const staged = await dependencies.staging.read(context, uploadId, filename, {
                kind: 'import',
                targetId: library.id,
                title,
                requestId,
            })
            upload = staged.upload
        } else upload = await readEbookUpload(context, filename)
        const { text, created } = await store.ebook(library, { title, upload, requestId })
        const ebook = checkedResponse(textSchema, text)
        if (!created) return ebook
        try {
            const emoji = await store.chooseEbookEmoji(
                context.subject,
                { title, filename },
                AbortSignal.any([context.signal, AbortSignal.timeout(12000)]),
            )
            if (isValidEmoji(emoji)) {
                await store.setEbookEmoji(ebook.id, emoji)
                return { ...ebook, emoji }
            }
        } catch (error) {
            // Emoji failures must not turn a saved book into a failed, retryable import.
            if (!(error instanceof MobileError && error.code === 'quota_exceeded')) {
                console.error('[mobile/ebook] emoji assignment failed', { textId: ebook.id, error })
            }
        }
        return ebook
    }

    return { vocabularyList, savedWord, editWord, extractArticle, importArticle, uploadEbook }
}
