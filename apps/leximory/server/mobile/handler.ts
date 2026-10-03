import { z } from 'zod'
import { resourceID, accountSchema, librariesSchema, textsSchema, documentSchema, audioSchema } from '@repo/api'
import type { MobileSubject } from '@repo/schema/mobile'
import { requireMobileSubject, type BearerVerifier } from './auth'
import { MobileError, mobileErrorResponse } from './errors'
import { createCatalog, type CatalogStore } from './catalog'

export function createMobileHandler(dependencies: {
    verify: BearerVerifier
    store: CatalogStore
    account: (subject: MobileSubject, signal: AbortSignal) => Promise<z.infer<typeof accountSchema>>
}) {
    const catalog = createCatalog(dependencies.store)
    return async (request: Request): Promise<Response> => {
        try {
            const subject = await requireMobileSubject(request, dependencies.verify)
            const url = new URL(request.url)
            const prefix = '/api/mobile/v1/'
            if (!url.pathname.startsWith(prefix) || request.method !== 'GET') throw new MobileError('inaccessible')
            const segments = url.pathname.slice(prefix.length).split('/').map(segment => resourceID.parse(segment))
            const cursor = url.searchParams.get('cursor') ?? undefined
            if (url.searchParams.size > (cursor ? 1 : 0)) throw new MobileError('invalid_input')
            const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20000)])
            let result: unknown
            if (segments.length === 1 && segments[0] === 'me') {
                result = accountSchema.parse(await dependencies.account(subject, signal))
            } else if (segments.length === 1 && segments[0] === 'libraries') {
                result = librariesSchema.parse(await catalog.libraries(subject, cursor, signal))
            } else if (segments.length === 3 && segments[0] === 'libraries' && segments[2] === 'texts') {
                result = textsSchema.parse(await catalog.texts(subject, segments[1]!, cursor, signal))
            } else if (segments.length === 2 && segments[0] === 'texts') {
                result = documentSchema.parse(await catalog.document(subject, segments[1]!, signal))
            } else if (segments.length === 4 && segments[0] === 'texts' && segments[2] === 'audio') {
                result = audioSchema.parse(await catalog.audio(subject, segments[1]!, segments[3]!, signal))
            } else { throw new MobileError('inaccessible') }
            return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
        } catch (error) {
            return mobileErrorResponse(error instanceof z.ZodError ? new MobileError('invalid_input') : error)
        }
    }
}
