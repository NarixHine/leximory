import 'server-only'
import { supabase } from '@repo/supabase'
import { Plan } from '@repo/env/config'

export async function getUsersPlansByIds(userIds: string[]): Promise<Record<string, Plan>> {
    if (userIds.length === 0) {
        return {}
    }

    const { data: users, error } = await supabase
        .from('users')
        .select('id, plan')
        .in('id', userIds)

    if (error) {
        throw new Error(`Failed to fetch user plans: ${error.message}`)
    }

    return users.reduce((acc, user) => {
        acc[user.id] = (user.plan || 'beginner') as Plan
        return acc
    }, {} as Record<string, Plan>)
}
