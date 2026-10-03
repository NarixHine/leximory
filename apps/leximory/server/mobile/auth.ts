import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { mobileSubjectSchema, type MobileSubject } from '@repo/schema/mobile'
import { MobileError } from './errors'

type Verification =
    | { kind: 'authenticated'; subject: MobileSubject }
    | { kind: 'unauthenticated' }
    | { kind: 'unavailable' }
export type BearerVerifier = (token: string, signal: AbortSignal) => Promise<Verification>

export async function requireMobileSubject(request: Request, verify: BearerVerifier): Promise<MobileSubject> {
    const authorization = request.headers.get('authorization')
    const match = authorization && authorization.length <= 16384
        ? /^Bearer +([A-Za-z0-9\-._~+/]+=*)$/i.exec(authorization)
        : null
    const token = match?.[1]
    if (!token) throw new MobileError('unauthenticated')
    const result = await verify(token, request.signal)
    switch (result.kind) {
        case 'authenticated': return result.subject
        case 'unauthenticated': throw new MobileError('unauthenticated')
        case 'unavailable': throw new MobileError('service_unavailable')
        default: {
            const exhaustive: never = result
            return exhaustive
        }
    }
}

export function createSupabaseBearerVerifier({
    url, anonKey, fetcher = fetch,
}: { url: string; anonKey: string; fetcher?: typeof fetch }): BearerVerifier {
    return async (token, signal) => {
        const client = createClient(url, anonKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            global: {
                fetch: (input, init) => fetcher(input, {
                    ...init,
                    cache: 'no-store',
                    signal: AbortSignal.any([
                        signal, AbortSignal.timeout(10000), ...(init?.signal ? [init.signal] : []),
                    ]),
                }),
            },
        })
        const { data, error } = await client.auth.getUser(token)
        if (error) {
            return { kind: error.status === 400 || error.status === 401 || error.status === 403
                ? 'unauthenticated' : 'unavailable' }
        }
        if (!data.user) return { kind: 'unauthenticated' }
        const subject = mobileSubjectSchema.safeParse({ userId: data.user.id })
        return subject.success ? { kind: 'authenticated', subject: subject.data } : { kind: 'unavailable' }
    }
}
