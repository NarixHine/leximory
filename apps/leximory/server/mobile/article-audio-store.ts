import 'server-only'
import { randomUUID } from 'node:crypto'
import { getMembership } from '@repo/user/membership'
import { redis } from '@repo/kv/redis'
import { supabase } from '@repo/supabase'
import { PLAN_AUDIO_QUOTA } from '@repo/env/config'
import { revalidateTag } from 'next/cache'
import { speak } from '@/server/ai/speak'
import { uploadAudio } from '@/server/db/audio'
import { MobileError } from './errors'
import type { ArticleAudioStore } from './article-audio'

async function exists(id: string) {
    const { data, error } = await supabase.storage.from('user-files').info(`audio/${id}.mp3`)
    if (error) {
        if ('statusCode' in error && ['400', '404'].includes(String(error.statusCode))) return false
        throw error
    }
    return !!data
}
export const articleAudioStore: ArticleAudioStore = {
    async generate({ id, text, lang, userId, signal }) {
        if (await exists(id)) return
        const lock = `mobile:article-audio:${id}`
        const lease = randomUUID()
        if (!(await redis.set(lock, lease, { nx: true, ex: 600 }))) throw new MobileError('service_unavailable')
        try {
            if (await exists(id)) return
            signal.throwIfAborted()
            const { plan } = await getMembership(userId, signal)
            // The receipt survives failed uploads and lost responses. Retrying this article costs no extra quota.
            const allowed = await redis.eval(
                `if redis.call('EXISTS', KEYS[2]) == 1 then return 2 end
                 local used = tonumber(redis.call('GET', KEYS[1]) or '0')
                 if used + 1 > tonumber(ARGV[1]) then return 0 end
                 redis.call('INCRBYFLOAT', KEYS[1], 1)
                 if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], 2592000) end
                 redis.call('SET', KEYS[2], '1', 'EX', 2592000)
                 return 1`,
                [`user:${userId}:audio_quota`, `mobile:audio-receipt:${userId}:${id}`],
                [PLAN_AUDIO_QUOTA[plan]],
            )
            if (allowed !== 1 && allowed !== 2) throw new MobileError('quota_exceeded')
            if (allowed === 1) revalidateTag(`quota:${userId}:audio`, { expire: 0 })
            const audio = await speak({ text, lang, userId, signal })
            signal.throwIfAborted()
            await uploadAudio({ id, audio })
        } finally {
            await redis.eval(
                "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",
                [lock],
                [lease],
            )
        }
    },
}
