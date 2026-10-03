import { z } from 'zod'
import { ebookSchema, ebookBookmarkSchema, resourceID } from '@repo/api'
import type { MobileSubject } from '@repo/schema/mobile'
import { createCatalog, summarizeText, summarizeLibrary, type CatalogStore } from './catalog'
import { requireMobileSubject, type BearerVerifier } from './auth'
import { MobileError, mobileErrorResponse } from './errors'

export interface EbookStore {
    asset(id: string, signal: AbortSignal): Promise<{ url: string; format: 'pdf' | 'epub' } | null>
    location(textId: string, userId: string): Promise<string | null>
    bookmarks(textId: string, userId: string): Promise<z.infer<typeof ebookBookmarkSchema>[]>
    savePosition(textId: string, userId: string, location: string): Promise<void>
    saveBookmark(input: { textId: string; userId: string; quote: string; chapter: string | null; location: string | null }): Promise<z.infer<typeof ebookBookmarkSchema>>
}
export function createEbookHandler(dependencies: { verify: BearerVerifier; catalog: CatalogStore; ebooks: EbookStore }) {
    const catalog = createCatalog(dependencies.catalog)
    return async (request: Request): Promise<Response> => {
        try {
            const subject: MobileSubject = await requireMobileSubject(request, dependencies.verify)
            const match = /^\/api\/mobile\/v1\/texts\/([A-Za-z0-9_-]{1,128})\/(ebook|ebook-position|ebook-bookmarks)$/.exec(new URL(request.url).pathname)
            const textId = match?.[1]
            if (!textId) throw new MobileError('inaccessible')
            const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20000)])
            const { text, library } = await catalog.authorizedText(subject, textId, signal)
            if (!text.has_ebook) throw new MobileError('unsupported_format')
            const store = dependencies.ebooks
            let result: unknown
            if (match[2] === 'ebook' && request.method === 'GET') {
                const [asset, location, bookmarks, archived] = await Promise.all([
                    store.asset(textId, signal), store.location(textId, subject.userId), store.bookmarks(textId, subject.userId), dependencies.catalog.archived(subject, signal),
                ])
                if (!asset) throw new MobileError('inaccessible')
                result = ebookSchema.parse({ text: summarizeText(text), library: summarizeLibrary(library, subject, archived), ...asset,
                    expiresAt: new Date(Date.now() + 3600000).toISOString(), location, bookmarks })
            } else if (request.method === 'POST') {
                const reader = request.body?.getReader()
                if (!reader) throw new MobileError('invalid_input')
                const chunks: Uint8Array[] = []; let count = 0
                try {
                    while (true) {
                        const chunk = await reader.read()
                        if (chunk.done) break
                        count += chunk.value.byteLength
                        if (count > 65536) { await reader.cancel(); throw new MobileError('invalid_input') }
                        chunks.push(chunk.value)
                    }
                } finally { reader.releaseLock() }
                const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
                if (match[2] === 'ebook-position') {
                    const input = z.object({ location: z.string().min(1).max(2048) }).strict().parse(body)
                    await store.savePosition(textId, subject.userId, input.location)
                    result = { saved: true }
                } else if (match[2] === 'ebook-bookmarks') {
                    const input = z.object({ quote: z.string().min(1).max(16000), chapter: z.string().max(512).nullable(), location: z.string().max(2048).nullable() }).strict().parse(body)
                    result = ebookBookmarkSchema.parse(await store.saveBookmark({ ...input, textId, userId: subject.userId }))
                } else { throw new MobileError('inaccessible') }
            } else { throw new MobileError('inaccessible') }
            signal.throwIfAborted()
            return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
        } catch (error) { return mobileErrorResponse(error instanceof z.ZodError || error instanceof SyntaxError ? new MobileError('invalid_input') : error) }
    }
}
