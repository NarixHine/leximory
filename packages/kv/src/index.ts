import 'server-only'
import { redis } from './redis'
import { cacheTag } from 'next/cache'
import { seconds } from 'itty-time'

export async function incrementQuota(userId: string, type: 'commentary' | 'audio' = 'commentary', incrBy: number = 1) {
    const quotaKey = `user:${userId}:${type}_quota`
    const quota = await redis.incrbyfloat(quotaKey, incrBy)

    if (quota === incrBy) {
        await redis.expire(quotaKey, seconds('30 days'))
    }

    return quota
}

export async function getQuota(userId: string, type: 'commentary' | 'audio' = 'commentary'): Promise<number> {
    'use cache'
    cacheTag(`quota:${userId}:${type}`)

    const quotaKey = `user:${userId}:${type}_quota`
    return (await redis.get(quotaKey)) ?? 0
}

export async function getQuotaTTL(userId: string, type: 'commentary' | 'audio' = 'commentary') {
    'use cache'
    cacheTag(`quota:${userId}:${type}`)

    const quotaKey = `user:${userId}:${type}_quota`
    return await redis.ttl(quotaKey)
}
