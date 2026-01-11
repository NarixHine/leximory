import { Plan } from '@/globals'
import { momentSH } from '@/lib/moment'
import { requireAdmin } from '@/server/auth/role'
import { supabase } from '@repo/supabase'
import { getUsersPlansByIds } from '@/server/db/user'

export async function getUsersOverview() {
    await requireAdmin()

    const { data, error } = await supabase.auth.admin.listUsers({
        perPage: 1000
    })
    if (error) {
        throw new Error('Failed to fetch users')
    }

    const { users } = data
    const totalUsers = users.length
    const activeUsers = users.filter(user => {
        const lastSignIn = new Date(user.last_sign_in_at || 0)
        const thirtyDaysAgo = momentSH().subtract(30, 'days').toDate()
        return lastSignIn > thirtyDaysAgo
    }).length

    const userIds = users.map(user => user.id)
    const userPlans = await getUsersPlansByIds(userIds)

    const usersByPlan = users.reduce((acc, user) => {
        const plan = userPlans[user.id] as Plan || 'beginner'
        acc[plan] = (acc[plan] || 0) + 1
        return acc
    }, {} as Record<Plan, number>)

    return {
        totalUsers,
        activeUsers,
        usersByPlan
    }
}

export async function getAllUsers() {
    await requireAdmin()

    const { data, error } = await supabase.auth.admin.listUsers({
        perPage: 1000
    })
    if (error) {
        throw new Error('Failed to fetch users')
    }

    const { users } = data
    const userIds = users.map(user => user.id)
    const userPlans = await getUsersPlansByIds(userIds)

    return users.map(user => ({
        id: user.id,
        email: user.email,
        username: user.user_metadata?.usernamen ?? user.id,
        plan: userPlans[user.id] || 'beginner',
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
        emailConfirmedAt: user.email_confirmed_at,
        avatarUrl: user.user_metadata?.avatar_url,
    }))
}
