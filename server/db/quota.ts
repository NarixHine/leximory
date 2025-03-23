import { redis } from '../client/redis'
import { unstable_cacheTag as cacheTag, revalidateTag } from 'next/cache'
import { after } from 'next/server'

export async function incrementQuota(userId: string, type: 'commentary' | 'audio', incrBy: number = 1) {
    const quotaKey = `user:${userId}:${type}_quota`
    const quota = await redis.incrbyfloat(quotaKey, incrBy)

    if (quota === incrBy) {
        await redis.expire(quotaKey, 60 * 60 * 24 * 30) // 30 days
    }

    after(() => revalidateTag(`quota:${userId}:${type}`))

    return quota
}

export async function getQuota(userId: string, type: 'commentary' | 'audio'): Promise<number> {
    'use cache'
    cacheTag(`quota:${userId}:${type}`)

    const quotaKey = `user:${userId}:${type}_quota`
    return (await redis.get(quotaKey)) ?? 0
}
