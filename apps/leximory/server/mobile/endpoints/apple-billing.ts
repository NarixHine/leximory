import 'server-only'
import { redis } from '@repo/kv/redis'
import { getMembership } from '@repo/user/membership'
import { appleBilling } from '../../billing/store'
import { appleConfigured } from '../../billing/apple'
import { AppleBillingError } from '../../billing/service'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { createAppleBillingOperations } from '../apple-billing'

const operations = createAppleBillingOperations({
    async deliver(userId, signedTransaction, signal) {
        if (!appleConfigured()) throw new AppleBillingError('unavailable')
        const key = `apple:delivery:${userId}:${Math.floor(Date.now() / 60000)}`
        const count = await redis.incr(key)
        await redis.expire(key, 120)
        if (count > 60) throw new AppleBillingError('unavailable')
        const receipt = await appleBilling.deliver(userId, signedTransaction, signal)
        const membership = await getMembership(userId, signal)
        return { ...receipt, plan: membership.plan }
    },
})
export const appleTransaction = mobileEndpoint(verify, operations.appleTransaction, 60000)
