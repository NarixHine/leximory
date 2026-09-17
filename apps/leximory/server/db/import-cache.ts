import 'server-only'
import crypto from 'crypto'
import { redis } from '@repo/kv/redis'
import { seconds } from 'itty-time'

const hashUrl = (url: string) => crypto.createHash('sha256').update(url).digest('hex')

export const getImportPrefetch = async ({ userId, url }: { userId: string; url: string }) => {
    return (await redis.get(`import:prefetch:${userId}:${hashUrl(url)}`)) as { lib: string } | null
}

export const setImportPrefetch = async ({
    userId,
    url,
    lib,
}: {
    userId: string
    url: string
    lib: string
}) => {
    const key = `import:prefetch:${userId}:${hashUrl(url)}`
    await redis.set(key, { lib })
    await redis.expire(key, seconds('1 day'))
}
