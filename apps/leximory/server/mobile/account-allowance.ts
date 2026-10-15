import { z } from 'zod'
import { accountSchema } from '@repo/api'
import { checkedResponse } from './http'

const storedUsage = z
    .union([
        z.number(),
        z
            .string()
            .regex(/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i)
            .transform(Number),
    ])
    .nullable()
    .transform((value) => value ?? 0)
    .pipe(z.number().nonnegative())
const allowanceSchema = accountSchema.shape.definitions.extend({ used: storedUsage })

export async function readAccountAllowance({
    store,
    userId,
    type,
    limit,
}: {
    store: { get(key: string): Promise<unknown>; ttl(key: string): Promise<number> }
    userId: string
    type: 'commentary' | 'audio'
    limit: number
}) {
    const key = `user:${userId}:${type}_quota`
    const [used, resetsIn] = await Promise.all([store.get(key), store.ttl(key)])
    return checkedResponse(allowanceSchema, { used, limit, resetsIn })
}
