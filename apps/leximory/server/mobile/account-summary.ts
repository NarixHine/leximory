import 'server-only'
import { PLAN_COMMENTARY_QUOTA } from '@repo/env/config'
import { getMembership } from '@repo/user/membership'
import { redis } from '@repo/kv/redis'
import type { MobileSubject } from '@repo/schema/mobile'
import { readAccountAllowance } from './account-allowance'

export async function accountSummary(subject: MobileSubject, signal: AbortSignal) {
    const { plan } = await getMembership(subject.userId, signal)
    const definitions = await readAccountAllowance({
        store: redis,
        userId: subject.userId,
        type: 'commentary',
        limit: PLAN_COMMENTARY_QUOTA[plan],
    })
    signal.throwIfAborted()
    return {
        userId: subject.userId,
        plan,
        definitions,
    }
}
