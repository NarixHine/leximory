import { z } from 'zod'
import { serializeWord } from './word-format'
import {
    extractedArticleSchema,
    articleImportSchema,
    resourceID,
    savedWordSchema,
    textSchema,
    vocabularyEditSchema,
} from '@repo/api'
import { MAX_FILE_SIZE, maxArticleLength } from '@repo/env/content'
import { canWriteLibrary } from '@repo/service/access'
import type { MobileSubject } from '@repo/schema/mobile'
import { MobileError } from './errors'
import { bodyBytes, checkedResponse, jsonBody, query, type MobileContext, type MobileOperation } from './http'
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
    ebook(library: LibraryRow, title: string, file: File): Promise<z.infer<typeof textSchema>>
    chooseEbookEmoji(
        subject: MobileSubject,
        input: { title: string; filename: string },
        signal: AbortSignal,
    ): Promise<string>
    setEbookEmoji(id: string, emoji: string): Promise<void>
}
const vocabularyPageSchema = z.object({ items: z.array(savedWordSchema), nextCursor: z.string().nullable() }).strict()
const articlePreviewInput = z.object({ url: z.url().max(2048) }).strict()

export function createAuthoringOperations(dependencies: { catalog: CatalogStore; authoring: AuthoringStore }) {
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
        const library = await catalog.authorizedLibrary(subject, resourceID.parse(params.libraryId), signal)
        if (!canWriteLibrary(subject, library) || library.shadow) throw new MobileError('inaccessible')
        return library
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
        const parameters = query(context.request, ['title', 'filename'])
        const title = z.string().trim().min(1).max(512).parse(parameters.title)
        const filename = z.string().min(1).max(512).parse(parameters.filename)
        const extension = filename.split('.').at(-1)?.toLowerCase()
        if (extension !== 'epub' && extension !== 'pdf') throw new MobileError('unsupported_format')
        const bytes = await bodyBytes(context.request, MAX_FILE_SIZE, context.signal)
        const file = new File([bytes], filename, {
            type: extension === 'pdf' ? 'application/pdf' : 'application/epub+zip',
        })
        const validSignature =
            extension === 'pdf'
                ? new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-'
                : bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4
        if (!validSignature) throw new MobileError('unsupported_format')
        const ebook = checkedResponse(textSchema, await store.ebook(library, title, file))
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
