import 'server-only'
import env from '@repo/env'
import { redis } from '@repo/kv/redis'
import { supabase } from '@repo/supabase'
import { getMembership } from '@repo/user/membership'
import { createEbookStaging } from './ebook-staging'

export const { staging: ebookStaging, cleanExpiredEbookUploads } = createEbookStaging({
    database: supabase,
    redis,
    getMembership,
    endpoint: env.NEXT_PUBLIC_SUPABASE_URL,
    publicKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
})
