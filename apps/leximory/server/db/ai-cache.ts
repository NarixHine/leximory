import 'server-only'
import { redis } from '@repo/kv/redis'
import { seconds } from 'itty-time'
import type { LocationDetection, ResolvedLocation } from '@/lib/location'

export const getAnnotationCache = async ({ hash }: { hash: string }) => {
    const cache = (await redis.get(`annotation:${hash}`)) as string | null
    return cache
}

export const setAnnotationCache = async ({ hash, cache }: { hash: string; cache: string }) => {
    await redis.set(`annotation:${hash}`, cache)
    await redis.expire(`annotation:${hash}`, seconds('1 day'))
}

/**
 * Cached Jev verdict (place + kind) for a selection. Upstash auto-deserializes
 * JSON, so objects round-trip natively — never store stringly-typed values.
 * `v2` avoids colliding with the previous boolean-shaped entries.
 */
export const getLocationDetectionCache = async ({ hash }: { hash: string }) =>
    (await redis.get<LocationDetection>(`location-detect:v2:${hash}`)) ?? null

export const setLocationDetectionCache = async ({
    hash,
    detection,
}: {
    hash: string
    detection: LocationDetection
}) => {
    await redis.set(`location-detect:v2:${hash}`, detection)
    await redis.expire(`location-detect:v2:${hash}`, seconds('1 day'))
}

/** Cached resolved location, keyed by the same hash as its detection. */
export const getLocationCache = async ({ hash }: { hash: string }) =>
    (await redis.get<ResolvedLocation>(`location:v2:${hash}`)) ?? null

export const setLocationCache = async ({
    hash,
    location,
}: {
    hash: string
    location: ResolvedLocation
}) => {
    await redis.set(`location:v2:${hash}`, location)
    await redis.expire(`location:v2:${hash}`, seconds('1 day'))
}
