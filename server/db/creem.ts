import 'server-only'
import { supabase } from '../client/supabase'
import { Plan } from '@/server/auth/quota'
import { clerkClient } from '@clerk/nextjs/server'
import { redis } from '../client/redis'

export async function getCustomerId(userId: string) {
    const { data, error } = await supabase
        .from('users')
        .select('creem_id')
        .eq('id', userId)
        .single()
    if (error) throw error
    return data.creem_id
}

export async function fillCustomerId({ userId, customerId }: { userId: string, customerId: string }) {
    const { error } = await supabase
        .from('users')
        .update({ creem_id: customerId })
        .eq('id', userId)
    if (error) throw error
}

export async function getUserIdByCustomerId(customerId: string) {
    const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('creem_id', customerId)
        .single()
    if (error) throw error
    return data.id
}

export async function updateSubscription({ userId, plan }: { userId: string, plan: Plan }) {
    await (await clerkClient()).users.updateUserMetadata(userId, {
        publicMetadata: {
            plan,
        },
    })
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

export async function toggleOrgCreationAccess({ userId, enabled }: { userId: string, enabled: boolean }) {
    await (await clerkClient()).users.updateUser(userId, {
        createOrganizationEnabled: enabled,
    })
}
