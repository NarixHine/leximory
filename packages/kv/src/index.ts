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
    await redis.expire(`annotation:${hash}`, seconds('1 week'))
}

export const getAskCache = async ({ hash }: { hash: string }) => {
    const cache = await redis.get(`ask:${hash}`) as string | null
    return cache
}

export const setAskCache = async ({ hash, cache }: { hash: string, cache: string }) => {
    await redis.set(`ask:${hash}`, cache)
    await redis.expire(`ask:${hash}`, seconds('1 week'))
}

/**
 * Sets a lock for dictation generation to prevent race conditions.
 * Returns true if lock was acquired, false if already locked.
 */
export const acquireDictationLock = async ({ paperId }: { paperId: number }): Promise<boolean> => {
    const lockKey = `dictation:lock:${paperId}`
    const acquired = await redis.setnx(lockKey, 'generating')
    if (acquired) {
        await redis.expire(lockKey, seconds('5 minutes'))
        return true
    }
    return false
}

/**
 * Releases the dictation generation lock.
 */
export const releaseDictationLock = async ({ paperId }: { paperId: number }) => {
    const lockKey = `dictation:lock:${paperId}`
    await redis.del(lockKey)
}

/**
 * Checks if dictation generation is in progress.
 */
export const isDictationGenerating = async ({ paperId }: { paperId: number }): Promise<boolean> => {
    const lockKey = `dictation:lock:${paperId}`
    const value = await redis.get(lockKey)
    return value !== null
}

/**
 * Atomically increments the paper edit version and returns the new version.
 * Used to enforce write ordering and prevent lost updates / race conditions.
 * The version key has a TTL to avoid unbounded growth for inactive papers.
 */
export const incrementPaperVersion = async ({ paperId }: { paperId: number }): Promise<number> => {
    const key = paperVersionKey(paperId)
    const version = await redis.incr(key)
    await redis.expire(key, seconds('7 days'))
    return version
}

/**
 * Gets the current paper edit version from Redis.
 * Returns 0 if no version has been set yet.
 */
export const getPaperVersion = async ({ paperId }: { paperId: number }): Promise<number> => {
    const version = await redis.get(paperVersionKey(paperId))
    return typeof version === 'number' ? version : 0
}

function paperVersionKey(paperId: number) {
    return `paper:version:${paperId}`
}
