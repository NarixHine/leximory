import 'server-only'
import { redis } from '@repo/kv/redis'
import { getMembership } from '@repo/user/membership'
import { PLAN_COMMENTARY_QUOTA } from '@repo/env/config'
import { MobileError } from './errors'
import { invalidateMutationCaches } from './mutation-effects'
import { mobileMutationID } from './vocabulary-save'

export async function chargeCommentaryQuota(input: {
    userId: string
    cost: number
    limit: number
    requestId?: string
    durableReceipt?: boolean
}): Promise<boolean> {
    const keys = [`user:${input.userId}:commentary_quota`]
    if (input.requestId) keys.push('mobile:quota-receipt:' + mobileMutationID(input.userId, input.requestId))
    const allowed = await redis.eval(
        `if KEYS[2] and redis.call('EXISTS', KEYS[2]) == 1 then return 2 end
         local used = tonumber(redis.call('GET', KEYS[1]) or '0')
         local cost = tonumber(ARGV[1])
         if used + cost > tonumber(ARGV[2]) then return 0 end
         redis.call('INCRBYFLOAT', KEYS[1], cost)
         if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], 2592000) end
         if KEYS[2] then
             if ARGV[3] == '1' then redis.call('SET', KEYS[2], '1')
             else redis.call('SET', KEYS[2], '1', 'EX', 86400) end
         end
         return 1`,
        keys,
        input.durableReceipt ? [input.cost, input.limit, '1'] : [input.cost, input.limit],
    )
    if (allowed === 1) invalidateMutationCaches(`quota:${input.userId}:commentary`)
    return allowed === 1 || allowed === 2
}

export async function requireCommentaryQuota(userId: string, cost: number, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    const { plan } = await getMembership(userId, signal)
    if (!(await chargeCommentaryQuota({ userId, cost, limit: PLAN_COMMENTARY_QUOTA[plan] }))) {
        throw new MobileError('quota_exceeded')
    }
}
