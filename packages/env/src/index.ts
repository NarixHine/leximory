import { z } from '@repo/schema'
import { createEnv } from '@t3-oss/env-nextjs'

export const IS_PROD = process.env.NODE_ENV === 'production'

const env = createEnv({
    server: {
        APPLE_APP_ID: z.coerce.number().int().positive().optional(),
        APPLE_SUBSCRIPTION_GROUP_ID: z.string().min(1).optional(),
        APPLE_ISSUER_ID: z.uuid().optional(),
        APPLE_KEY_ID: z
            .string()
            .regex(/^[A-Z0-9]{10}$/)
            .optional(),
        APPLE_PRIVATE_KEY: z.string().min(1).optional(),
        APPLE_ROOT_CERTIFICATES: z.string().min(1).optional(),
        APPLE_SANDBOX_USER_IDS: z.string().optional(),
        APPLE_PURCHASES_ENABLED: z.enum(['true', 'false']).optional(),

        ELEVENLABS_API_KEY: z.string().min(1),
        UPSTASH_REDIS_REST_URL: z.string().min(1),
        UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
        VAPID_PRIVATE_KEY: z.string().min(1),
        CREEM_API_KEY: z.string().min(1),
        CREEM_WEBHOOK_SECRET: z.string().min(1),
        SUPABASE_URL: z.string().min(1),
        SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
        AI_GATEWAY_API_KEY: z.string().min(1),
        TABSTACK_API_KEY: z.string().min(1),
        QSTASH_URL: z.string().min(1),
        QSTASH_TOKEN: z.string().min(1),
        QSTASH_CURRENT_SIGNING_KEY: z.string().min(1),
        QSTASH_NEXT_SIGNING_KEY: z.string().min(1),
        INNGEST_EVENT_KEY: z.string().trim().min(1),
        INNGEST_SIGNING_KEY: z.string().trim().min(1),
        INNGEST_ENV: z.string().trim().min(1).optional(),
        INNGEST_DEV: z.union([z.enum(['0', '1', 'true', 'false']), z.url()]).optional(),
        INNGEST_BASE_URL: z.url().optional(),
        VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
    },

    client: {
        NEXT_PUBLIC_LEXIMORY_URL: z.string().min(1),
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1),
        NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
        NEXT_PUBLIC_SIGN_IN_URL: z.string().min(1),
    },

    runtimeEnv: {
        APPLE_APP_ID: process.env.APPLE_APP_ID,
        APPLE_SUBSCRIPTION_GROUP_ID: process.env.APPLE_SUBSCRIPTION_GROUP_ID,
        APPLE_ISSUER_ID: process.env.APPLE_ISSUER_ID,
        APPLE_KEY_ID: process.env.APPLE_KEY_ID,
        APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY,
        APPLE_ROOT_CERTIFICATES: process.env.APPLE_ROOT_CERTIFICATES,
        APPLE_SANDBOX_USER_IDS: process.env.APPLE_SANDBOX_USER_IDS,
        APPLE_PURCHASES_ENABLED: process.env.APPLE_PURCHASES_ENABLED,

        // Audio Generation
        ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
        // Scraping
        TABSTACK_API_KEY: process.env.TABSTACK_API_KEY,
        // Redis
        UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
        UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
        // Web Push Notifications
        VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
        NEXT_PUBLIC_LEXIMORY_URL: process.env.NEXT_PUBLIC_LEXIMORY_URL,
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        // Creem Integration
        CREEM_API_KEY: process.env.CREEM_API_KEY,
        CREEM_WEBHOOK_SECRET: process.env.CREEM_WEBHOOK_SECRET,
        // Supabase
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NEXT_PUBLIC_SIGN_IN_URL: process.env.NEXT_PUBLIC_SIGN_IN_URL,
        // AI Gateway
        AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
        // QStash
        QSTASH_URL: process.env.QSTASH_URL,
        QSTASH_TOKEN: process.env.QSTASH_TOKEN,
        QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
        QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
        INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
        INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
        INNGEST_ENV: process.env.INNGEST_ENV,
        INNGEST_DEV: process.env.INNGEST_DEV,
        INNGEST_BASE_URL: process.env.INNGEST_BASE_URL,
        VERCEL_ENV: process.env.VERCEL_ENV,
    },
})

export default env
