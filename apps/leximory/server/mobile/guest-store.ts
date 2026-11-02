import { z } from 'zod'
import { definitionSchema } from '@repo/api'
import { LangSchema } from '@repo/schema/library'
import { mobileErrorSchema } from '@repo/schema/mobile'
import { checkedResponse } from './http'
import { MobileError } from './errors'
import {
    guestDefinitionLimit,
    guestGenerationLifetime,
    guestResultLifetime,
    guestSessionLifetime,
    type GuestRequest,
    type GuestResult,
    type GuestSession,
    type GuestStore,
} from './guest'

export interface GuestRedis {
    eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown>
    get(key: string): Promise<unknown>
    mget(...keys: string[]): Promise<unknown[]>
}
const storedNumber = z
    .union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
    .pipe(z.number().int().nonnegative())
const sessionSchema = z.object({ id: z.uuid(), expiresAt: z.iso.datetime() }).strict()
const settledSchema = z.discriminatedUnion('state', [
    z.object({ state: z.literal('completed'), language: LangSchema, definition: definitionSchema }).strict(),
    z.object({ state: z.literal('failed'), error: mobileErrorSchema.shape.error }).strict(),
])
const sessionKey = (hash: string) => 'mobile:guest:token:' + hash
const activeSessionKey = (id: string) => 'mobile:guest:session:' + id
const requestKey = (id: string, requestId: string) => 'mobile:guest:request:' + id + ':' + requestId
const quotaKey = (id: string, day: string) => 'mobile:guest:quota:' + id + ':' + day
const requestSet = (id: string) => 'mobile:guest:requests:' + id

export const enrollGuestScript = `
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
if used >= 6 then return 0 end
redis.call('INCR', KEYS[1])
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], 3600) end
redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2])
redis.call('SET', KEYS[3], '1', 'EX', ARGV[2])
return 1`

export const beginGuestScript = `
if redis.call('EXISTS', KEYS[1]) == 0 then return -3 end
local previous = redis.call('GET', KEYS[2])
if previous then
    if previous ~= ARGV[1] then return -1 end
    return 2
end
if redis.call('GET', KEYS[4]) then return -4 end
local used = tonumber(redis.call('GET', KEYS[3]) or '0')
if used >= tonumber(ARGV[2]) then return 0 end
redis.call('INCR', KEYS[3])
if redis.call('TTL', KEYS[3]) < 0 then redis.call('EXPIRE', KEYS[3], ARGV[3]) end
redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[4])
redis.call('SET', KEYS[2] .. ':started', ARGV[5], 'EX', ARGV[4])
redis.call('SET', KEYS[2] .. ':quota', KEYS[3], 'EX', ARGV[4])
redis.call('SET', KEYS[2] .. ':state', 'running', 'EX', ARGV[4])
redis.call('SET', KEYS[4], ARGV[6], 'EX', ARGV[7])
redis.call('SADD', KEYS[5], ARGV[6])
redis.call('EXPIRE', KEYS[5], ARGV[8])
return 1`

export const finishGuestScript = `
if redis.call('EXISTS', KEYS[1]) == 0 then return -3 end
local state = redis.call('GET', KEYS[2] .. ':state')
if state == 'completed' or state == 'failed' then return 2 end
local previous = redis.call('GET', KEYS[2])
if not previous or (ARGV[1] ~= '' and previous ~= ARGV[1]) then return -1 end
redis.call('SET', KEYS[2] .. ':result', ARGV[2], 'EX', ARGV[3])
redis.call('SET', KEYS[2] .. ':state', ARGV[6], 'EX', ARGV[7])
if ARGV[4] == '0' then
    local quota = redis.call('GET', KEYS[2] .. ':quota')
    if quota and tonumber(redis.call('GET', quota) or '0') > 0 then redis.call('DECR', quota) end
end
if redis.call('GET', KEYS[3]) == ARGV[5] then redis.call('DEL', KEYS[3]) end
return 1`

export const revokeGuestScript = `
redis.call('DEL', KEYS[1], KEYS[2], KEYS[3])
local requests = redis.call('SMEMBERS', KEYS[4])
for _, requestId in ipairs(requests) do
    local key = ARGV[1] .. requestId
    redis.call('DEL', key, key .. ':started', key .. ':quota', key .. ':result', key .. ':state')
end
redis.call('DEL', KEYS[4])
return 1`

export function createGuestStore(redis: GuestRedis): GuestStore {
    function checked(result: unknown) {
        if (result === -3) throw new MobileError('unauthenticated')
        if (result === -1) throw new MobileError('invalid_input')
        if (result === -4) throw new MobileError('service_unavailable')
        if (result === 0) throw new MobileError('quota_exceeded')
        if (result !== 1 && result !== 2) throw new MobileError('service_unavailable')
        return result
    }
    return {
        async enroll({ network, tokenHash, session }) {
            checked(
                await redis.eval(
                    enrollGuestScript,
                    ['mobile:guest:enroll:' + network, sessionKey(tokenHash), activeSessionKey(session.id)],
                    [JSON.stringify(session), guestSessionLifetime],
                ),
            )
        },
        async session(hash) {
            const value = await redis.get(sessionKey(hash))
            if (value === null) return null
            return checkedResponse(sessionSchema, value)
        },
        async allowance(id, window) {
            const value = await redis.get(quotaKey(id, window.day))
            const used = z.coerce
                .number()
                .int()
                .nonnegative()
                .safeParse(value ?? 0)
            if (!used.success) throw new MobileError('service_unavailable')
            return { used: used.data, limit: guestDefinitionLimit, resetsAt: window.resetsAt }
        },
        async begin(input) {
            const value = checked(
                await redis.eval(
                    beginGuestScript,
                    [
                        activeSessionKey(input.sessionId),
                        requestKey(input.sessionId, input.requestId),
                        quotaKey(input.sessionId, input.window.day),
                        activeSessionKey(input.sessionId) + ':running',
                        requestSet(input.sessionId),
                    ],
                    [
                        input.hash,
                        guestDefinitionLimit,
                        input.window.expiresIn + 60,
                        input.window.expiresIn,
                        input.startedAt,
                        input.requestId,
                        guestGenerationLifetime,
                        guestSessionLifetime,
                    ],
                ),
            )
            return value === 1 ? 'new' : 'existing'
        },
        async result(id, requestId): Promise<GuestResult | null> {
            const key = requestKey(id, requestId)
            const [hash, completed, started, state] = await redis.mget(
                key,
                key + ':result',
                key + ':started',
                key + ':state',
            )
            if (typeof hash !== 'string') return null
            if (completed !== null) return checkedResponse(settledSchema, completed)
            if (state === 'completed') return { state: 'failed', error: new MobileError('inaccessible').body.error }
            if (state === 'failed') return { state: 'failed', error: new MobileError('service_unavailable').body.error }
            const timestamp = storedNumber.pipe(z.number().positive()).safeParse(started)
            if (!timestamp.success) throw new MobileError('service_unavailable')
            return { state: 'running', startedAt: timestamp.data }
        },
        async finish(input: GuestRequest, result, charged) {
            checked(
                await redis.eval(
                    finishGuestScript,
                    [
                        activeSessionKey(input.sessionId),
                        requestKey(input.sessionId, input.requestId),
                        activeSessionKey(input.sessionId) + ':running',
                    ],
                    [
                        input.hash,
                        JSON.stringify(result),
                        guestResultLifetime,
                        charged ? '1' : '0',
                        input.requestId,
                        result.state,
                        input.window.expiresIn,
                    ],
                ),
            )
        },
        async revoke(hash, id) {
            checked(
                await redis.eval(
                    revokeGuestScript,
                    [sessionKey(hash), activeSessionKey(id), activeSessionKey(id) + ':running', requestSet(id)],
                    [requestKey(id, '')],
                ),
            )
        },
    }
}
