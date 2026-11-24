import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { MOBILE_EBOOK_MAX_BYTES } from '@repo/env/content'
import { ebookUploadGrantInputSchema } from '@repo/api'
import type { redis as redisClient } from '@repo/kv/redis'
import type { supabase } from '@repo/supabase'
import type { getMembership as resolveMembership } from '@repo/user/membership'
import { ebookFormat, ebookUploadFromBytes, type EbookStaging } from './ebook-upload'
import { ebookStorageError, isMissingObject } from './ebook-storage'
import { MobileError, mobileDependency } from './errors'
import { checkedResponse } from './http'
import { withMutationLease } from './mutation-lease'
import { readEbookSource } from './ebook-source'
import {
    ebookStagingBucket,
    ebookUploadWindowKey,
    ebookStagingPrefix,
    requireEbookStagingBucket,
    signedEbookUploadLifetime,
} from './ebook-staging-lifecycle'
import { z } from 'zod'

const grantLifetime = 3 * 3600
const retention = 48 * 3600 * 1000
const grantSchema = ebookUploadGrantInputSchema.extend({
    path: z.string(),
    base: z.string().nullable(),
})
const grantKey = (userId: string, id: string) => `user:${userId}:ebook-upload:${id}`

function resumableURL(endpoint: string) {
    const url = new URL(endpoint)
    if (/^[a-z0-9]+\.supabase\.co$/.test(url.hostname))
        url.hostname = url.hostname.replace('.supabase.co', '.storage.supabase.co')
    return new URL('/storage/v1/upload/resumable/sign', url).href
}

export function createEbookStaging({
    database,
    redis,
    getMembership,
    endpoint,
    publicKey,
}: {
    database: Pick<typeof supabase, 'storage'>
    redis: Pick<typeof redisClient, 'get' | 'set' | 'eval'>
    getMembership: typeof resolveMembership
    endpoint: string
    publicKey: string
}) {
    const storage = database.storage.from(ebookStagingBucket)

    async function requirePaidSubscription(userId: string, signal: AbortSignal) {
        const membership = await getMembership(userId, signal)
        if (membership.legacyPlan === 'beginner' && !membership.memberships.some(({ status }) => status === 'active'))
            throw new MobileError('ebook_subscription_required')
    }

    async function stagedSize(path: string) {
        return mobileDependency('ebook.staging.stat', async () => {
            const { data, error } = await storage.info(path)
            if (error) {
                if (await isMissingObject(error)) return null
                throw ebookStorageError(error)
            }
            return checkedResponse(z.int().positive(), data.size)
        })
    }

    const staging: EbookStaging = {
        async prepare({ subject: { userId }, signal }, input) {
            const now = Date.now()
            const expiresAt = (input.requestedAt ?? now) + grantLifetime * 1000
            if (expiresAt <= now || (input.requestedAt ?? now) > now + 60_000) throw new MobileError('stale_revision')
            await requirePaidSubscription(userId, signal)
            const id = createHash('sha256')
                .update(JSON.stringify([userId, input]))
                .digest('hex')
            const key = grantKey(userId, id)
            return withMutationLease(redis, key + ':prepare', 30, async () => {
                const existing = await redis.get(key)
                if (existing) {
                    const { path, size } = checkedResponse(grantSchema, existing)
                    const actual = await stagedSize(path)
                    if (actual === size) return { id, upload: null }
                    if (actual !== null) throw new MobileError('invalid_input')
                    return signedGrant(userId, id, path, signal)
                }

                await mobileDependency('ebook.staging.bucket', () => requireEbookStagingBucket(database.storage))

                const allowed = await redis.eval(
                    "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], 3600) end; return n <= 30 and 1 or 0",
                    [`user:${userId}:ebook-upload-rate`],
                    [],
                )
                if (allowed !== 1) throw new MobileError('ebook_upload_limit')

                const path = ebookStagingPrefix(userId) + randomUUID() + '.' + ebookFormat(input.filename).extension
                const base =
                    input.kind === 'replace' ? ((await readEbookSource(redis, input.targetId))?.id ?? null) : null
                await redis.set(key, { ...input, path, base }, { pxat: expiresAt })
                return signedGrant(userId, id, path, signal)
            })
        },
        async read({ subject: { userId }, signal }, id, filename, target) {
            await requirePaidSubscription(userId, signal)
            const value = await redis.get(grantKey(userId, id))
            if (!value) throw new MobileError('invalid_input')
            const grant = checkedResponse(grantSchema, value)
            if (
                grant.kind !== target.kind ||
                grant.targetId !== target.targetId ||
                grant.filename !== filename ||
                (target.kind === 'import' && (grant.title !== target.title || grant.requestId !== target.requestId))
            )
                throw new MobileError('invalid_input')
            const size = await stagedSize(grant.path)
            if (size === null) throw new MobileError('service_unavailable')
            if (size !== grant.size || size > MOBILE_EBOOK_MAX_BYTES) throw new MobileError('invalid_input')
            signal.throwIfAborted()
            const bytes = await mobileDependency('ebook.staging.download', async () => {
                const { data, error } = await storage.download(grant.path)
                if (error) throw ebookStorageError(error)
                if (data.size !== size) throw new MobileError('invalid_input')
                return new Uint8Array(await data.arrayBuffer())
            })
            if (createHash('sha256').update(bytes).digest('hex') !== grant.sha256)
                throw new MobileError('invalid_input')
            signal.throwIfAborted()
            const upload = ebookUploadFromBytes(filename, bytes)
            return target.kind === 'import' ? { upload } : { upload, replacement: { id, base: grant.base } }
        },
    }

    async function signedGrant(userId: string, id: string, path: string, signal: AbortSignal) {
        signal.throwIfAborted()
        const allowed = await redis.eval(
            `if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
              local deadline = math.max(tonumber(redis.call('GET', KEYS[2])) or 0, tonumber(ARGV[1]))
              redis.call('SET', KEYS[2], tostring(deadline), 'EX', ARGV[2])
              return 1`,
            [`account-deletion:user:${userId}`, ebookUploadWindowKey(userId)],
            [Date.now() + signedEbookUploadLifetime, 52 * 3600],
        )
        if (allowed !== 1) throw new MobileError('inaccessible')
        signal.throwIfAborted()
        const token = await mobileDependency('ebook.staging.sign', async () => {
            const { data, error } = await storage.createSignedUploadUrl(path)
            if (error) throw ebookStorageError(error, 'BUCKET_NOT_FOUND')
            return data.token
        })
        return { id, upload: { url: resumableURL(endpoint), token, publicKey, bucket: ebookStagingBucket, path } }
    }

    async function cleanExpiredEbookUploads(cutoff: number): Promise<number> {
        const { data, error } = await storage.list('', { limit: 100, sortBy: { column: 'created_at', order: 'asc' } })
        if (error) throw error
        const expired = data.filter((entry) => entry.id && Date.parse(entry.created_at) < cutoff - retention)
        if (expired.length) {
            const result = await storage.remove(expired.map((entry) => entry.name))
            if (result.error) throw result.error
        }
        return expired.length
    }

    return { staging, cleanExpiredEbookUploads }
}
