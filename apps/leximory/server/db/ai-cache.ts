import 'server-only'
import { redis } from '@repo/kv/redis'
import { seconds } from 'itty-time'
import type { ResolvedLocation } from '@/lib/location'

export const getAnnotationCache = async ({ hash }: { hash: string }) => {
    const cache = (await redis.get(`annotation:${hash}`)) as string | null
    return cache
}

export const setAnnotationCache = async ({ hash, cache }: { hash: string; cache: string }) => {
    await redis.set(`annotation:${hash}`, cache)
    await redis.expire(`annotation:${hash}`, seconds('1 day'))
}

/**
 * Cached Jev verdict for whether a selection refers to a mappable place.
 * Upstash auto-deserializes JSON, so a boolean round-trips as a boolean —
 * stringly-typed values would come back as numbers and never compare equal.
 */
export const getLocationDetectionCache = async ({ hash }: { hash: string }) =>
    (await redis.get<boolean>(`location-detect:${hash}`)) ?? null

export const setLocationDetectionCache = async ({
    hash,
    isLocation,
}: {
    hash: string
    isLocation: boolean
}) => {
    await redis.set(`location-detect:${hash}`, isLocation)
    await redis.expire(`location-detect:${hash}`, seconds('1 day'))
}

/** Cached resolved location, keyed by the same hash as its detection. */
export const getLocationCache = async ({ hash }: { hash: string }) =>
    (await redis.get<ResolvedLocation>(`location:${hash}`)) ?? null

export const setLocationCache = async ({
    hash,
    location,
}: {
    hash: string
    location: ResolvedLocation
}) => {
    await redis.set(`location:${hash}`, location)
    await redis.expire(`location:${hash}`, seconds('1 day'))
}
