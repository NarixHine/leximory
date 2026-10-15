import { setTimeout as delay } from 'node:timers/promises'
import 'server-only'
import { z } from 'zod'
import { shortcutWordResultSchema } from '@repo/api'
import { redis } from '@repo/kv/redis'
import { mobileMutationID } from './vocabulary-save'
import { MobileError } from './errors'
import { checkedResponse } from './http'
import type { ShortcutStore } from './shortcuts'

const receiptSchema = z.object({ word: z.string(), result: shortcutWordResultSchema.optional() }).strict()
const key = (userId: string, requestId: string) => 'mobile:shortcut:' + mobileMutationID(userId, requestId)

export const shortcutStore: ShortcutStore = {
    async begin(subject, requestId, word, lease, signal) {
        const id = key(subject.userId, requestId)
        await redis.set(id, { word }, { nx: true, ex: 86400 })
        let pause = 250
        while (true) {
            signal.throwIfAborted()
            const receipt = checkedResponse(receiptSchema, await redis.get(id))
            if (receipt.word !== word) throw new MobileError('invalid_input')
            if (receipt.result) return receipt.result
            const acquired = await redis.set(id + ':lease', lease, { nx: true, ex: 65 })
            if (acquired) return checkedResponse(receiptSchema, await redis.get(id)).result ?? null
            await delay(pause, undefined, { signal })
            pause = Math.min(pause * 2, 1000)
        }
    },
    async complete(subject, requestId, word, result, lease) {
        const id = key(subject.userId, requestId)
        const completed = await redis.eval(
            `if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
             redis.call('SET', KEYS[1], ARGV[2], 'EX', 86400)
             return 1`,
            [id, id + ':lease'],
            [lease, JSON.stringify({ word, result })],
        )
        if (completed !== 1) throw new MobileError('service_unavailable')
    },
    async release(subject, requestId, lease) {
        await redis.eval(
            `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
             return 0`,
            [key(subject.userId, requestId) + ':lease'],
            [lease],
        )
    },
}
