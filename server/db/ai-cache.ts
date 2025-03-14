import { redis } from "../client/redis"

export const getAnnotationCache = async ({ hash }: { hash: string }) => {
    const cache = await redis.get(`annotation:${hash}`) as string | null
    return cache
}

export const setAnnotationCache = async ({ hash, cache }: { hash: string, cache: string }) => {
    await redis.set(`annotation:${hash}`, cache)
    await redis.expire(`annotation:${hash}`, 60 * 5)
}
