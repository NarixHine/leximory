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

export const getAnnotationCache = async ({ hash }: { hash: string }) => {
    const cache = await redis.get(`annotation:${hash}`) as string | null
    return cache
}

export const setAnnotationCache = async ({ hash, cache }: { hash: string, cache: string }) => {
    await redis.set(`annotation:${hash}`, cache)
    await redis.expire(`annotation:${hash}`, seconds('1 day'))
}

export const getAskCache = async ({ hash }: { hash: string }) => {
    const cache = await redis.get(`ask:${hash}`) as string | null
    return cache
}

export const setAskCache = async ({ hash, cache }: { hash: string, cache: string }) => {
    await redis.set(`ask:${hash}`, cache)
    await redis.expire(`ask:${hash}`, seconds('1 day'))
}
