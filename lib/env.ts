import { z } from 'zod'
import { createEnv } from '@t3-oss/env-nextjs'

export const IS_PROD = process.env.NODE_ENV === 'production'
export const TIMES_IS_PAUSED = true

const env = createEnv({
    server: {
        ELEVENLABS_API_KEY: z.string().min(1),
        UPSTASH_REDIS_REST_URL: z.string().min(1),
        UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
        VAPID_PRIVATE_KEY: z.string().min(1),
        CREEM_API_KEY: z.string().min(1),
        CREEM_WEBHOOK_SECRET: z.string().min(1),
        SUPABASE_URL: z.string().min(1),
        SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
        GOOGLE_VERTEX_CLIENT_EMAIL: z.string().min(1),
        GOOGLE_VERTEX_PRIVATE_KEY: z.string().min(1),
        GOOGLE_VERTEX_PROJECT: z.string().min(1),
        GOOGLE_VERTEX_LOCATION: z.string().min(1),
        R2_ACCOUNT_ID: z.string().min(1),
        R2_ACCESS_KEY_ID: z.string().min(1),
        R2_SECRET_ACCESS_KEY: z.string().min(1),
        R2_BUCKET_NAME: z.string().min(1),
        R2_PUBLIC_URL: z.string().min(1),
    },

    client: {
        NEXT_PUBLIC_URL: z.string().min(1),
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1),
        NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    },

    runtimeEnv: {
        ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
        UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
        UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
        VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
        NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        CREEM_API_KEY: process.env.CREEM_API_KEY,
        CREEM_WEBHOOK_SECRET: process.env.CREEM_WEBHOOK_SECRET,
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        GOOGLE_VERTEX_CLIENT_EMAIL: process.env.GOOGLE_VERTEX_CLIENT_EMAIL,
        GOOGLE_VERTEX_PRIVATE_KEY: process.env.GOOGLE_VERTEX_PRIVATE_KEY,
        GOOGLE_VERTEX_PROJECT: process.env.GOOGLE_VERTEX_PROJECT,
        GOOGLE_VERTEX_LOCATION: process.env.GOOGLE_VERTEX_LOCATION,
        R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
        R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
        R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
        R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
    },
})

export default env
