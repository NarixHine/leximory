import 'server-only'
import { supabase } from '@repo/supabase'
import { Plan } from '@repo/env/config'
import { redis } from '@repo/kv/redis'
import { updatePlan } from '@repo/user'

export async function getCustomerId(userId: string) {
    const { data } = await supabase
        .from('users')
        .select('creem_id')
        .eq('id', userId)
        .single()
        .throwOnError()

    return data.creem_id
}

export async function fillCustomerId({ userId, customerId }: { userId: string, customerId: string }) {
    await supabase
        .from('users')
        .update({ creem_id: customerId })
        .eq('id', userId)
        .throwOnError()
}

export async function getUserIdByCustomerId(customerId: string) {
    const { data } = await supabase
        .from('users')
        .select('id')
        .eq('creem_id', customerId)
        .single()
        .throwOnError()
    return data.id
}

export async function updateSubscription({ userId, plan }: { userId: string, plan: Plan }) {
    await updatePlan(userId, plan)
}

export async function createRequest(userId: string) {
    const requestId = crypto.randomUUID()
    await redis.set(`creem:request:${requestId}`, userId, {
        ex: 60 * 60 * 24,
    })
    return requestId
}

export async function getRequestUserId(requestId: string) {
    const userId = await redis.get(`creem:request:${requestId}`) as string | null
    if (!userId) {
        throw new Error('Request not found')
    }
    return userId
}

