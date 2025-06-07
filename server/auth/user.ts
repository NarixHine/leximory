import { createClient } from '@/server/client/supabase/server'
import { Plan } from './quota'
import { redirect } from 'next/navigation'
import { supabase } from '../client/supabase'

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
        redirect('/auth/login')
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
    const { data: { user }, error } = await supabase.auth.getUser(userId)
    if (error || !user) {
        redirect('/auth/login')
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
