import 'server-only'
import { createClient } from '@/server/client/supabase/server'
import { Plan } from '@/lib/config'
import { redirect } from 'next/navigation'
import { supabase } from '../client/supabase'
import { SIGN_IN_URL } from '@/lib/config'

export async function getSession() {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getSession()
    if (error || !data?.session) return null
    return data.session
}

export async function getUserOrThrow() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
        redirect(SIGN_IN_URL)
    }
    const { id, email, user_metadata: { username, avatar_url }, last_sign_in_at, created_at } = user
    return {
        userId: id,
        email: email as string,
        username: username as string | undefined,
        image: avatar_url as string | undefined,
        lastActiveAt: last_sign_in_at as string,
        createdAt: created_at as string,
    }
}

export async function getPlan(userId?: string) {
    if (!userId) {
        return await getPlan((await getUserOrThrow()).userId)
    }
    const { data: { plan } } = await supabase.from('users').select('plan').eq('id', userId).single().throwOnError()
    return (plan ?? 'beginner') as Plan
}

export async function updatePlan(userId: string, plan: Plan) {
    const supabase = await createClient()
    await supabase.from('users').update({ plan }).eq('id', userId)
}

export async function getUserById(userId: string) {
    const { data: { user }, error } = await supabase.auth.admin.getUserById(userId)
    if (error || !user) {
        throw new Error('User not found')
    }
    const { id, email, user_metadata: { username, avatar_url, plan }, last_sign_in_at, created_at } = user
    return {
        userId: id,
        email: email as string,
        username: username as string | undefined,
        image: avatar_url as string | undefined,
        lastActiveAt: last_sign_in_at as string,
        plan: (plan ?? 'beginner') as Plan,
        createdAt: created_at as string,
    }
}
