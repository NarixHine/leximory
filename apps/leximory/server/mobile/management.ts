import { createHash } from 'node:crypto'
import { z } from 'zod'
import { editableTextSchema, resourceID, textEditSchema, textSchema } from '@repo/api'
import { MAX_FILE_SIZE, maxArticleLength } from '@repo/env/content'
import { canWriteLibrary } from '@repo/service/access'
import { createCatalog, summarizeText, type CatalogStore, type TextRow } from './catalog'
import type { AuthoringStore } from './authoring'
import { MobileError } from './errors'
import { bodyBytes, checkedResponse, jsonBody, query, type MobileContext, type MobileOperation } from './http'

export interface ManagementStore {
    edit(text: TextRow, fields: z.infer<typeof textEditSchema>): Promise<TextRow>
    remove(text: TextRow): Promise<void>
    replaceEbook(text: TextRow, file: File): Promise<void>
    removeEbook(text: TextRow): Promise<void>
    removeWord(id: string, libraryId: string): Promise<void>
}
export function textRevision(text: TextRow) {
    return createHash('sha256')
        .update(JSON.stringify([text.title, text.topics, text.emoji, text.content, text.has_ebook]))
        .digest('hex')
}
const editInput = textEditSchema.extend({ revision: z.string().max(128) }).strict()
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })

async function emptyBody(context: MobileContext) {
    if (context.request.body)
        z.object({})
            .strict()
            .parse(await jsonBody(context.request, 1024, context.signal))
    else if (Number(context.request.headers.get('content-length') ?? 0) !== 0) throw new MobileError('invalid_input')
    query(context.request, [])
}
export function createManagementOperations(dependencies: {
    catalog: CatalogStore
    authoring: Pick<AuthoringStore, 'word'>
    management: ManagementStore
}) {
    const catalog = createCatalog(dependencies.catalog)
    const store = dependencies.management
    async function writableText(context: MobileContext) {
        const result = await catalog.authorizedText(
            context.subject,
            resourceID.parse(context.params.textId),
            context.signal,
        )
        if (!canWriteLibrary(context.subject, result.library) || result.library.shadow || result.text.bookmark_url)
            throw new MobileError('inaccessible')
        return result
    }
    const editableText: MobileOperation = async (context) => {
        query(context.request, [])
        const { text } = await writableText(context)
        const progress = await dependencies.catalog.progress?.(text.id)
        return checkedResponse(editableTextSchema, {
            text: summarizeText(text),
            content: text.content,
            revision: textRevision(text),
            contentEditable: !text.has_ebook && !['annotating', 'saving'].includes(progress ?? ''),
        })
    }
    const editText: MobileOperation = async (context) => {
        query(context.request, [])
        const { text, library } = await writableText(context)
        const { revision, ...fields } = editInput.parse(await jsonBody(context.request, 1100000, context.signal))
        if (revision !== textRevision(text)) throw new MobileError('stale_revision')
        if (fields.content !== text.content) {
            if (
                text.has_ebook ||
                ['annotating', 'saving'].includes((await dependencies.catalog.progress?.(text.id)) ?? '')
            )
                throw new MobileError('stale_revision')
            // Existing annotation markup may exceed the import limit. Preserve it when only editing metadata.
            if (fields.content.length > Math.max(text.content.length, maxArticleLength(library.lang)))
                throw new MobileError('invalid_input')
        }
        if (
            fields.emoji !== null &&
            (Array.from(segmenter.segment(fields.emoji)).length !== 1 ||
                !/\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(fields.emoji))
        )
            throw new MobileError('invalid_input')
        return checkedResponse(textSchema, summarizeText(await store.edit(text, fields)))
    }
    const removeText: MobileOperation = async (context) => {
        query(context.request, [])
        const { libraryId } = z
            .object({ libraryId: resourceID })
            .strict()
            .parse(await jsonBody(context.request, 1024, context.signal))
        const library = await catalog.authorizedLibrary(context.subject, libraryId, context.signal)
        if (!canWriteLibrary(context.subject, library) || library.shadow) throw new MobileError('inaccessible')
        const id = resourceID.parse(context.params.textId)
        const text = await dependencies.catalog.text(id, context.signal)
        if (!text) return { removed: true }
        if (text.id !== id) throw new MobileError('service_unavailable')
        if (text.lib !== library.id || text.bookmark_url) throw new MobileError('inaccessible')
        await store.remove(text)
        return { removed: true }
    }
    const replaceEbook: MobileOperation = async (context) => {
        const { text } = await writableText(context)
        const filename = z
            .string()
            .min(1)
            .max(512)
            .parse(query(context.request, ['filename']).filename)
        const extension = filename.split('.').at(-1)?.toLowerCase()
        if (extension !== 'pdf' && extension !== 'epub') throw new MobileError('unsupported_format')
        const bytes = await bodyBytes(context.request, MAX_FILE_SIZE, context.signal)
        const valid =
            extension === 'pdf'
                ? new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-'
                : bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4
        if (!valid) throw new MobileError('unsupported_format')
        await store.replaceEbook(
            text,
            new File([bytes], filename, { type: extension === 'pdf' ? 'application/pdf' : 'application/epub+zip' }),
        )
        return checkedResponse(textSchema, summarizeText({ ...text, has_ebook: true }))
    }
    const removeEbook: MobileOperation = async (context) => {
        const { text } = await writableText(context)
        await emptyBody(context)
        await store.removeEbook(text)
        return checkedResponse(textSchema, summarizeText({ ...text, has_ebook: false }))
    }
    const removeWord: MobileOperation = async (context) => {
        query(context.request, [])
        const { libraryId } = z
            .object({ libraryId: resourceID })
            .strict()
            .parse(await jsonBody(context.request, 1024, context.signal))
        const library = await catalog.authorizedLibrary(context.subject, libraryId, context.signal)
        if (!canWriteLibrary(context.subject, library)) throw new MobileError('inaccessible')
        const id = resourceID.parse(context.params.wordId)
        const word = await dependencies.authoring.word(id)
        if (!word) return { removed: true }
        if (word.id !== id) throw new MobileError('service_unavailable')
        if (word.libraryId !== library.id || word.protected) throw new MobileError('inaccessible')
        await store.removeWord(id, library.id)
        return { removed: true }
    }
    return { editableText, editText, removeText, replaceEbook, removeEbook, removeWord }
}
