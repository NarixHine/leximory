import 'server-only'
import { createClient } from '@repo/supabase/server'
import { Plan, prefixUrl } from '@repo/env/config'
import { redirect } from 'next/navigation'
import { supabase } from '@repo/supabase'
import { SIGN_IN_URL } from '@repo/env/config'
import { ensureUserExists } from '@repo/supabase/user'

export async function getSession() {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getSession()
    if (error || !data?.session) return null
    return data.session
}

export async function getUser() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
        return null
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

export async function getUserOrThrow() {
    const user = await getUser()
    if (!user) {
        redirect(prefixUrl(SIGN_IN_URL))
    }
    return user
}

export async function getPlan(userId?: string) {
    if (!userId) {
        return await getPlan((await getUserOrThrow()).userId)
    }
    await ensureUserExists(userId)
    const { data: { plan } } = await supabase.from('users').select('plan').eq('id', userId).single().throwOnError()
    return (plan ?? 'beginner') as Plan
}

export async function updatePlan(userId: string, plan: Plan) {
    return await supabase.from('users').update({ plan }).eq('id', userId).throwOnError()
}

export async function getUserById(userId: string) {
    'use cache'
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
