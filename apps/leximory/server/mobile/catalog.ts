import { z } from 'zod'
import { resourceID, type MobileLibrary, type MobileText } from '@repo/api'
import { LangSchema } from '@repo/schema/library'
import type { MobileSubject } from '@repo/schema/mobile'
import { canReadLibrary } from '@repo/service/access'
import { MobileError } from './errors'
import { renderDocument } from './render-document'

export const libraryRowSchema = z.object({
    id: resourceID, name: z.string(), lang: LangSchema, owner: z.string(),
    access: z.number(), starred_by: z.array(z.string()).nullable(), shadow: z.boolean(),
})
export const textRowSchema = z.object({
    id: resourceID, lib: resourceID.nullable(), title: z.string(), topics: z.array(z.string()).nullable(),
    emoji: z.string().nullable(), has_ebook: z.boolean(), content: z.string(),
    created_at: z.string().nullable(), no: z.number().nullable(),
})
export type LibraryRow = z.infer<typeof libraryRowSchema>
export type TextRow = z.infer<typeof textRowSchema>
const cursorSchema = z.object({ libraryId: resourceID, no: z.number().nullable(), createdAt: z.string().nullable(), id: resourceID }).strict()
export type TextCursor = z.infer<typeof cursorSchema>
export const PAGE_SIZE = 40
export interface CatalogStore {
    library(id: string, signal: AbortSignal): Promise<LibraryRow | null>
    text(id: string, signal: AbortSignal): Promise<TextRow | null>
    libraries(subject: MobileSubject, after: string | null, signal: AbortSignal): Promise<LibraryRow[]>
    texts(libraryId: string, after: TextCursor | null, signal: AbortSignal): Promise<TextRow[]>
    archived(subject: MobileSubject, signal: AbortSignal): Promise<string[]>
    audio(id: string, signal: AbortSignal): Promise<string | null>
}
function encodeCursor(cursor: TextCursor) { return Buffer.from(JSON.stringify(cursor)).toString('base64url') }
export function decodeTextCursor(value: string | undefined, libraryId: string): TextCursor | null {
    if (!value) return null
    try {
        if (value.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error()
        const cursor = cursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')))
        if (cursor.libraryId !== libraryId) throw new Error()
        if (cursor.createdAt !== null && !/^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/.test(cursor.createdAt)) throw new Error()
        return cursor
    } catch { throw new MobileError('invalid_input') }
}
export function summarizeLibrary(row: LibraryRow, subject: MobileSubject, archived: string[]): MobileLibrary {
    return { id: row.id, name: row.name, language: row.lang, owned: row.owner === subject.userId, archived: archived.includes(row.id), shadow: row.shadow }
}
export function summarizeText(row: TextRow): MobileText {
    if (!row.lib) throw new MobileError('inaccessible')
    return { id: row.id, libraryId: row.lib, title: row.title, topics: row.topics ?? [], emoji: row.emoji, createdAt: row.created_at, format: row.has_ebook ? 'ebook' : 'article' }
}
export function createCatalog(store: CatalogStore) {
    async function authorizedLibrary(subject: MobileSubject, id: string, signal: AbortSignal) {
        const library = await store.library(id, signal)
        if (!library || !canReadLibrary(subject, library)) throw new MobileError('inaccessible')
        return library
    }
    async function authorizedText(subject: MobileSubject, id: string, signal: AbortSignal) {
        const text = await store.text(id, signal)
        if (!text?.lib) throw new MobileError('inaccessible')
        const library = await authorizedLibrary(subject, text.lib, signal)
        return { text, library }
    }
    return {
        async libraries(subject: MobileSubject, cursor: string | undefined, signal: AbortSignal) {
            if (cursor && !resourceID.safeParse(cursor).success) throw new MobileError('invalid_input')
            const [rows, archived] = await Promise.all([store.libraries(subject, cursor ?? null, signal), store.archived(subject, signal)])
            if (rows.some(row => !canReadLibrary(subject, row))) throw new MobileError('service_unavailable')
            const items = rows.slice(0, PAGE_SIZE)
            return { items: items.map(row => summarizeLibrary(row, subject, archived)), nextCursor: rows.length > PAGE_SIZE ? items.at(-1)?.id ?? null : null }
        },
        async texts(subject: MobileSubject, libraryId: string, cursor: string | undefined, signal: AbortSignal) {
            await authorizedLibrary(subject, libraryId, signal)
            const rows = await store.texts(libraryId, decodeTextCursor(cursor, libraryId), signal)
            if (rows.some(row => row.lib !== libraryId)) throw new MobileError('service_unavailable')
            const items = rows.slice(0, PAGE_SIZE)
            const last = items.at(-1)
            return { items: items.map(summarizeText), nextCursor: rows.length > PAGE_SIZE && last ? encodeCursor({ libraryId, id: last.id, no: last.no, createdAt: last.created_at }) : null }
        },
        async document(subject: MobileSubject, textId: string, signal: AbortSignal) {
            const { text, library } = await authorizedText(subject, textId, signal)
            const archived = await store.archived(subject, signal)
            return { text: summarizeText(text), library: summarizeLibrary(library, subject, archived), document: text.has_ebook ? null : renderDocument(text.content) }
        },
        async audio(subject: MobileSubject, textId: string, audioId: string, signal: AbortSignal) {
            const { text } = await authorizedText(subject, textId, signal)
            if (text.has_ebook || !renderDocument(text.content).blocks.some(block => block.audioId === audioId)) throw new MobileError('inaccessible')
            const url = await store.audio(audioId, signal)
            if (!url) throw new MobileError('inaccessible')
            return { url, expiresAt: new Date(Date.now() + 3600_000).toISOString() }
        },
        authorizedText,
        authorizedLibrary,
    }
}
