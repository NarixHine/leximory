import 'server-only'
import type { Redis } from '@upstash/redis'
import { deletionRecordSchema, type DeletionRecord } from './account-deletion'
import { deletionManifestSchema, type DeletionManifest } from './account-deletion-persistence'
import { checkedResponse } from './http'
import { MobileError } from './errors'

type LedgerRedis = Pick<Redis, 'get' | 'set' | 'eval' | 'del' | 'scan'>
const recordKey = (id: string) => `account-deletion:receipt:${id}`
const manifestKey = (id: string) => `account-deletion:manifest:${id}`

export function createAccountDeletionLedger(redis: LedgerRedis) {
    return {
        async begin(record: DeletionRecord): Promise<DeletionRecord> {
            const result = await redis.eval(
                `local active = redis.call('GET', KEYS[2])
                 if active and active ~= ARGV[1] then return 0 end
                 local existing = redis.call('GET', KEYS[1])
                 if existing then return existing end
                 redis.call('SET', KEYS[1], ARGV[2])
                 redis.call('SET', KEYS[2], ARGV[1])
                 return ARGV[2]`,
                [recordKey(record.requestId), `account-deletion:user:${record.userId}`],
                [record.requestId, JSON.stringify(record)],
            )
            if (result === 0) throw new MobileError('invalid_input')
            const saved = checkedResponse(
                deletionRecordSchema,
                typeof result === 'string' ? JSON.parse(result) : result,
            )
            if (saved.userId !== record.userId || saved.receiptDigest !== record.receiptDigest)
                throw new MobileError('invalid_input')
            return saved
        },
        async read(id: string): Promise<DeletionRecord | null> {
            const raw = await redis.get(recordKey(id))
            return raw ? checkedResponse(deletionRecordSchema, raw) : null
        },
        async status(record: DeletionRecord, status: DeletionRecord['status']) {
            if (status === 'completed') {
                await redis.eval(
                    `redis.call('SET', KEYS[1], ARGV[1], 'EX', 2592000)
                     redis.call('DEL', KEYS[2], KEYS[3])
                     return 1`,
                    [
                        recordKey(record.requestId),
                        manifestKey(record.requestId),
                        `account-deletion:user:${record.userId}`,
                    ],
                    [JSON.stringify({ ...record, status })],
                )
            } else await redis.set(recordKey(record.requestId), { ...record, status })
        },
        async manifest(id: string): Promise<DeletionManifest | null> {
            const raw = await redis.get(manifestKey(id))
            return raw ? checkedResponse(deletionManifestSchema, raw) : null
        },
        async saveManifest(id: string, manifest: DeletionManifest) {
            await redis.set(manifestKey(id), manifest)
        },
        async purge(userId: string, manifest: DeletionManifest) {
            for (const pattern of [
                `user:${userId}:*`,
                `import:prefetch:${userId}:*`,
                `mobile:audio-receipt:${userId}:*`,
                `mobile:vocabulary-create:${userId}:*`,
            ]) {
                let cursor = 0
                do {
                    const [next, keys] = await redis.scan(cursor, { match: pattern, count: 200 })
                    if (keys.length) await redis.del(...keys)
                    cursor = Number(next)
                } while (cursor !== 0)
            }
            if (manifest.texts.length) await redis.del(...manifest.texts.map((id) => `text:${id}:annotation`))
            for (const pattern of [
                'browser:receipt:*',
                'mobile:completion:*',
                'mobile:pdf-outline:*',
                'mobile:pdf-outline-receipt:*',
            ]) {
                let cursor = 0
                do {
                    const [next, keys] = await redis.scan(cursor, { match: pattern, count: 100 })
                    for (const key of keys) {
                        const value = JSON.stringify(await redis.get(key))
                        if (
                            value.includes(userId) ||
                            manifest.texts.some((id) => value.includes(`pdf-outlines/${id}/`))
                        )
                            await redis.del(key)
                    }
                    cursor = Number(next)
                } while (cursor !== 0)
            }
        },
    }
}
