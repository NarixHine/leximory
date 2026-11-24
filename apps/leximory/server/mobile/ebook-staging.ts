import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { MOBILE_EBOOK_MAX_BYTES } from '@repo/env/content'
import { ebookUploadGrantInputSchema } from '@repo/api'
import type { redis as redisClient } from '@repo/kv/redis'
import type { supabase } from '@repo/supabase'
import type { getMembership as resolveMembership } from '@repo/user/membership'
import { ebookFormat, ebookUploadFromBytes, type EbookStaging } from './ebook-upload'
import { isMissingObject } from './ebook-storage'
import { MobileError } from './errors'
import { checkedResponse } from './http'
import { withMutationLease } from './mutation-lease'
import { nextTextTimestamp } from './text-edit-store'
import { mobileMutationID } from './vocabulary-save'
import { z } from 'zod'

const bucketName = 'mobile-ebook-uploads'
const grantLifetime = 3 * 3600
const retention = 48 * 3600 * 1000
const grantSchema = ebookUploadGrantInputSchema.extend({
    path: z.string(),
    revision: z.string().nullable(),
})
const grantKey = (userId: string, id: string) => 'mobile:ebook-upload:' + mobileMutationID(userId, id)
const mimeTypes = ['application/pdf', 'application/epub+zip']

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
    const storage = database.storage.from(bucketName)

    async function requirePaidSubscription(userId: string, signal: AbortSignal) {
        const membership = await getMembership(userId, signal)
        if (membership.legacyPlan === 'beginner' && !membership.memberships.some(({ status }) => status === 'active'))
            throw new MobileError('ebook_subscription_required')
    }

    async function stagedSize(path: string) {
        const { data, error } = await storage.info(path)
        if (error) {
            if (await isMissingObject(error)) return null
            throw error
        }
        return checkedResponse(z.int().positive(), data.size)
    }

    const staging: EbookStaging = {
        async prepare({ subject: { userId }, signal }, input, revision) {
            await requirePaidSubscription(userId, signal)
            const id = createHash('sha256').update(JSON.stringify(input)).digest('hex')
            const key = grantKey(userId, id)
            return withMutationLease(redis, key + ':prepare', 30, async () => {
                const existing = await redis.get(key)
                if (existing) {
                    const { path, size } = checkedResponse(grantSchema, existing)
                    const actual = await stagedSize(path)
                    if (actual === size) return { id, upload: null }
                    if (actual !== null) throw new MobileError('invalid_input')
                    return signedGrant(id, path)
                }

                const { data: config, error: configError } = await database.storage.getBucket(bucketName)
                if (configError) throw configError
                if (
                    config.public ||
                    config.file_size_limit !== MOBILE_EBOOK_MAX_BYTES ||
                    !mimeTypes.every((mime) => config.allowed_mime_types?.includes(mime))
                )
                    throw new MobileError('service_unavailable', {
                        cause: new Error('Invalid ebook upload bucket settings'),
                    })

                const allowed = await redis.eval(
                    "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], 3600) end; return n <= 30 and 1 or 0",
                    ['mobile:ebook-upload-rate:' + userId],
                    [],
                )
                if (allowed !== 1) throw new MobileError('ebook_upload_limit')

                const path = randomUUID() + '.' + ebookFormat(input.filename).extension
                const grant = await signedGrant(id, path)
                await redis.set(key, { ...input, path, revision }, { ex: grantLifetime })
                return grant
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
            const { data, error } = await storage.download(grant.path)
            if (error) throw error
            if (data.size !== size) throw new MobileError('invalid_input')
            const bytes = new Uint8Array(await data.arrayBuffer())
            if (createHash('sha256').update(bytes).digest('hex') !== grant.sha256)
                throw new MobileError('invalid_input')
            signal.throwIfAborted()
            const upload = ebookUploadFromBytes(filename, bytes)
            if (target.kind === 'import') return { upload }
            const publicationKey = grantKey(userId, id) + ':publication'
            const candidate = nextTextTimestamp(grant.revision)
            const accepted = await redis.set(publicationKey, candidate, { nx: true, ex: grantLifetime })
            const publicationTime = accepted
                ? candidate
                : checkedResponse(z.iso.datetime(), await redis.get(publicationKey))
            return { upload, replacement: { revision: grant.revision, publicationTime } }
        },
    }

    async function signedGrant(id: string, path: string) {
        const { data, error } = await storage.createSignedUploadUrl(path)
        if (error) throw error
        return { id, upload: { url: resumableURL(endpoint), token: data.token, publicKey, bucket: bucketName, path } }
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
