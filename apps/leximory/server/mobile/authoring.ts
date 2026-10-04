import { z } from 'zod'
import { extractedArticleSchema, articleImportSchema, resourceID, savedWordSchema, textSchema, vocabularyEditSchema } from '@repo/api'
import { MAX_FILE_SIZE, maxArticleLength } from '@repo/env/content'
import { canWriteLibrary } from '@repo/service/access'
import type { MobileSubject } from '@repo/schema/mobile'
import { requireMobileSubject, type BearerVerifier } from './auth'
import { MobileError, mobileErrorResponse } from './errors'
import { createCatalog, type CatalogStore, type LibraryRow } from './catalog'

export type WordFields = z.infer<typeof vocabularyEditSchema>
export interface AuthoringStore {
    extract?(url: string): Promise<{ title: string; content: string }>
    words(libraryId: string, cursor: string | null): Promise<{ items: z.infer<typeof savedWordSchema>[]; nextCursor: string | null }>
    word(id: string): Promise<{ id: string; libraryId: string; fields: WordFields; createdAt?: string | null; protected?: boolean } | null>
    updateWord(id: string, libraryId: string, fields: WordFields): Promise<void>
    article(subject: MobileSubject, library: LibraryRow, input: z.infer<typeof articleImportSchema>): Promise<z.infer<typeof textSchema>>
    ebook(library: LibraryRow, title: string, file: File): Promise<z.infer<typeof textSchema>>
}
export function serializeWord(fields: WordFields): string {
    const values = [fields.original, fields.lemma, fields.definition, fields.etymology ?? '', fields.cognates ?? '']
    if (values.slice(0, 3).some(value => !value.trim())) throw new MobileError('invalid_input')
    while (values.length > 3 && !values.at(-1)) values.pop()
    if (values.some(value => /[{}]|\|\|/.test(value))) throw new MobileError('invalid_input')
    // Matches the canonical web annotation format.
    return `{{${values.join('||').replaceAll('\n', '')}}}`
}
function checkedResponse(schema: { safeParse(value: unknown): { success: true; data: unknown } | { success: false } }, value: unknown): unknown {
    const result = schema.safeParse(value)
    if (!result.success) throw new MobileError('service_unavailable')
    return result.data
}
export function createAuthoringHandler(dependencies: { verify: BearerVerifier; catalog: CatalogStore; authoring: AuthoringStore }) {
    const catalog = createCatalog(dependencies.catalog)
    return async (request: Request): Promise<Response> => {
        try {
            const subject = await requireMobileSubject(request, dependencies.verify)
            const url = new URL(request.url)
            const match = /^\/api\/mobile\/v1\/(vocabulary\/([^/]+)|libraries\/([^/]+)\/(articles|ebooks|vocabulary|article-preview))$/.exec(url.pathname)
            if (!match || !['GET', 'POST'].includes(request.method)) throw new MobileError('inaccessible')
            const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60000)])
            let result: unknown
            if (match[2]) {
                const id = resourceID.parse(match[2])
                const word = await dependencies.authoring.word(id)
                if (!word) throw new MobileError('inaccessible')
                const library = await catalog.authorizedLibrary(subject, word.libraryId, signal)
                if (request.method === 'POST') {
                    if (!canWriteLibrary(subject, library) || word.protected) throw new MobileError('inaccessible')
                    const fields = vocabularyEditSchema.parse(await request.json())
                    serializeWord(fields)
                    await dependencies.authoring.updateWord(id, word.libraryId, fields)
                    result = { ...word, fields }
                } else { result = word }
                result = checkedResponse(savedWordSchema, result)
            } else {
                const library = await catalog.authorizedLibrary(subject, resourceID.parse(match[3]), signal)
                if (match[4] === 'vocabulary' && request.method === 'GET') {
                    const cursor = url.searchParams.get('cursor')
                    if (cursor && !/^\d{1,7}$/.test(cursor)) throw new MobileError('invalid_input')
                    result = checkedResponse(z.object({ items: z.array(savedWordSchema), nextCursor: z.string().nullable() }).strict(), await dependencies.authoring.words(library.id, cursor))
                    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
                }
                if (!canWriteLibrary(subject, library)) throw new MobileError('inaccessible')
                if (request.method !== 'POST' || library.shadow || match[4] === 'vocabulary') throw new MobileError('inaccessible')
                if (match[4] === 'article-preview') {
                    const input = z.object({ url: z.url().max(2048) }).strict().parse(await request.json())
                    if (!dependencies.authoring.extract) throw new MobileError('service_unavailable')
                    const article = await dependencies.authoring.extract(input.url)
                    if (article.content.length > maxArticleLength(library.lang)) throw new MobileError('invalid_input')
                    return Response.json(checkedResponse(extractedArticleSchema, article), { headers: { 'Cache-Control': 'private, no-store' } })
                }
                if (match[4] === 'articles') {
                    const input = articleImportSchema.parse(await request.json())
                    if (input.content.length > maxArticleLength(library.lang)) throw new MobileError('invalid_input')
                    result = await dependencies.authoring.article(subject, library, input)
                } else {
                    const title = z.string().trim().min(1).max(512).parse(url.searchParams.get('title'))
                    const filename = z.string().min(1).max(512).parse(url.searchParams.get('filename'))
                    const extension = filename.split('.').at(-1)?.toLowerCase()
                    if (!['epub', 'pdf'].includes(extension ?? '')) throw new MobileError('unsupported_format')
                    // Bound the stream before buffering it, including chunked requests.
                    if (Number(request.headers.get('content-length') ?? 0) > MAX_FILE_SIZE) throw new MobileError('invalid_input')
                    const reader = request.body?.getReader()
                    if (!reader) throw new MobileError('invalid_input')
                    const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0
                    try {
                        while (true) {
                            signal.throwIfAborted()
                            const { value, done } = await reader.read()
                            if (done) break
                            size += value.length
                            if (size > MAX_FILE_SIZE) { await reader.cancel(); throw new MobileError('invalid_input') }
                            chunks.push(new Uint8Array(value))
                        }
                    } finally { reader.releaseLock() }
                    if (!size) throw new MobileError('invalid_input')
                    const file = new File(chunks, filename, { type: extension === 'pdf' ? 'application/pdf' : 'application/epub+zip' })
                    const prefix = new Uint8Array(await file.slice(0, 5).arrayBuffer())
                    if (extension === 'pdf' ? Buffer.from(prefix).toString() !== '%PDF-' : prefix[0] !== 0x50 || prefix[1] !== 0x4b || prefix[2] !== 3 || prefix[3] !== 4) throw new MobileError('unsupported_format')
                    result = await dependencies.authoring.ebook(library, title, file)
                }
                result = checkedResponse(textSchema, result)
            }
            return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
        } catch (error) { return mobileErrorResponse(error instanceof z.ZodError || error instanceof SyntaxError ? new MobileError('invalid_input') : error) }
    }
}
