import 'server-only'
import { z } from 'zod'
import { PLANS, PLAN_COMMENTARY_QUOTA } from '@repo/env/config'
import { supabase } from '@repo/supabase'
import { redis } from '@repo/kv/redis'
import type { MobileSubject } from '@repo/schema/mobile'
import { checkedResponse } from './http'

export async function accountSummary(subject: MobileSubject, signal: AbortSignal) {
    const { data } = await supabase
        .from('users')
        .select('plan')
        .eq('id', subject.userId)
        .abortSignal(signal)
        .maybeSingle()
        .throwOnError()
    const plan = checkedResponse(z.enum(PLANS), data?.plan ?? 'beginner')
    const key = `user:${subject.userId}:commentary_quota`
    const [used, resetsIn] = await Promise.all([redis.get<number>(key), redis.ttl(key)])
    signal.throwIfAborted()
    return {
        userId: subject.userId,
        plan,
        definitions: { used: used ?? 0, limit: PLAN_COMMENTARY_QUOTA[plan], resetsIn },
    }
}
