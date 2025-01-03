import { z } from 'zod'
import { createEnv } from '@t3-oss/env-nextjs'

export const isProd = process.env.NODE_ENV === 'production'
const env = createEnv({
    server: {
        CLERK_SECRET_KEY: z.string().min(1),
        XATA_API_KEY: z.string().min(1),
        GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
        ELEVENLABS_API_KEY: z.string().min(1),
        UPSTASH_REDIS_REST_URL: z.string().min(1),
        UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
        VAPID_PRIVATE_KEY: z.string().min(1),
        OPENAI_API_KEY: z.string().min(1),
    },

    client: {
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
        NEXT_PUBLIC_URL: z.string().min(1),
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1),
    },

    runtimeEnv: {
        CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        XATA_API_KEY: process.env.XATA_API_KEY,
        GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
        UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
        UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
        VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    },
})

export default env
