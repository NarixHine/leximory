import 'server-only'
import env from '@repo/env'
import { createSupabaseBearerVerifier } from '../auth'

export const verify = createSupabaseBearerVerifier({
    url: env.SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
})
