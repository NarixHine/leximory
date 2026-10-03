import { z } from 'zod'
import { requireMobileSubject, type BearerVerifier } from './auth'
import { createCatalog, type CatalogStore } from './catalog'
import { MobileError, mobileErrorResponse } from './errors'

export function createLibraryArchiveHandler(dependencies: {
    verify: BearerVerifier
    catalog: CatalogStore
    setArchived: (userId: string, libraryId: string, archived: boolean, signal: AbortSignal) => Promise<void>
}) {
    const catalog = createCatalog(dependencies.catalog)
    return async (request: Request): Promise<Response> => {
        try {
            const subject = await requireMobileSubject(request, dependencies.verify)
            const match = /^\/api\/mobile\/v1\/libraries\/([A-Za-z0-9_-]{1,128})\/archive$/.exec(new URL(request.url).pathname)
            const libraryId = match?.[1]
            if (!libraryId || request.method !== 'POST') throw new MobileError('inaccessible')
            const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20000)])
            await catalog.authorizedLibrary(subject, libraryId, signal)
            const reader = request.body?.getReader()
            if (!reader) throw new MobileError('invalid_input')
            const chunks: Uint8Array[] = []; let size = 0
            try {
                while (true) {
                    const part = await reader.read()
                    if (part.done) break
                    size += part.value.byteLength
                    if (size > 1024) { await reader.cancel(); throw new MobileError('invalid_input') }
                    chunks.push(part.value)
                }
            } finally { reader.releaseLock() }
            const { archived } = z.object({ archived: z.boolean() }).strict().parse(JSON.parse(Buffer.concat(chunks).toString('utf8')))
            await dependencies.setArchived(subject.userId, libraryId, archived, signal)
            return Response.json({ archived }, { headers: { 'Cache-Control': 'private, no-store' } })
        } catch (error) {
            return mobileErrorResponse(error instanceof z.ZodError || error instanceof SyntaxError ? new MobileError('invalid_input') : error)
        }
    }
}
