import 'server-only'
import env from '@repo/env'
import { createSupabaseBearerVerifier } from '../auth'
import { ensureUserExists } from '@repo/supabase/user'
import { mobileDependency } from '../errors'

const verifyBearer = createSupabaseBearerVerifier({
    url: env.SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
})

export async function verify(token: string, signal: AbortSignal) {
    const bounded = AbortSignal.any([signal, AbortSignal.timeout(10000)])
    const result = await verifyBearer(token, bounded)
    if (result.kind === 'authenticated')
        await mobileDependency('account.initialize', () => ensureUserExists(result.subject.userId, bounded))
    return result
}
