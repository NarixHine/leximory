import { redis } from "../client/redis"

export const getAnnotationCache = async ({ hash, userId }: { hash: string, userId: string }) => {
    const cache = await redis.get(`user:${userId}:annotation:${hash}`) as string | null
    return cache
}

export const setAnnotationCache = async ({ hash, userId, cache }: { hash: string, userId: string, cache: string }) => {
    await redis.set(`user:${userId}:annotation:${hash}`, cache)
    await redis.expire(`user:${userId}:annotation:${hash}`, 60 * 5)
}
