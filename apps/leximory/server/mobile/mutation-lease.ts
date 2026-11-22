import 'server-only'
import { randomUUID } from 'node:crypto'
import type { redis } from '@repo/kv/redis'
import { MobileError } from './errors'
import { mutationEffects } from './mutation-effects'

type MutationLeaseStore = Pick<typeof redis, 'set' | 'eval'>

export async function withMutationLease<T>(
    redis: MutationLeaseStore,
    key: string,
    seconds: number,
    work: () => Promise<T>,
): Promise<T> {
    const token = randomUUID()
    if (!(await redis.set(key, token, { nx: true, ex: seconds }))) throw new MobileError('service_unavailable')
    try {
        return await work()
    } finally {
        await mutationEffects.run({
            name: 'lease.release',
            run: async () => {
                await redis.eval(
                    "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",
                    [key],
                    [token],
                )
            },
        })
    }
}

export function withTextMutation<T>(redis: MutationLeaseStore, id: string, work: () => Promise<T>): Promise<T> {
    return withMutationLease(redis, `mobile:text-mutation:${id}`, 120, work)
}
