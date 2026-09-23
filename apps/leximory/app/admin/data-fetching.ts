import 'server-only'

import type { User } from '@supabase/supabase-js'
import { supabase } from '@repo/supabase'
import { PLANS, Plan } from '@repo/env/config'
import { requireAdmin } from '@/server/auth/role'
import { getUsersPlansByIds } from '@/server/db/user'
import { momentSH } from '@/lib/moment'

const PER_PAGE = 1000
const MAX_PAGES = 50
const TREND_DAYS = 30

export interface AdminUser {
    id: string
    email: string | null
    username: string
    plan: Plan
    createdAt: string | null
    lastSignInAt: string | null
    emailConfirmedAt: string | null
    avatarUrl: string | null
}

export interface AdminOverview {
    totalUsers: number
    activeUsers: number
    newThisWeek: number
    newThisMonth: number
    paidUsers: number
    verifiedUsers: number
    planCounts: Record<Plan, number>
    signupsByDay: { date: string; signups: number }[]
    recentUsers: AdminUser[]
}

async function fetchAuthUsers() {
    const users: User[] = []
    let page = 1

    while (page <= MAX_PAGES) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE })
        if (error) {
            throw new Error(`Failed to fetch users: ${error.message}`)
        }

        users.push(...data.users)

        const lastPage = data.lastPage ?? 1
        if (page >= lastPage) break
        page++
    }

    return users
}

function toAdminUser(user: User, plan: Plan): AdminUser {
    return {
        id: user.id,
        email: user.email ?? null,
        username: user.user_metadata?.username ?? user.email?.split('@')[0] ?? user.id,
        plan,
        createdAt: user.created_at ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
        emailConfirmedAt: user.email_confirmed_at ?? null,
        avatarUrl: user.user_metadata?.avatar_url ?? null,
    }
}

async function listUsers(): Promise<AdminUser[]> {
    const authUsers = await fetchAuthUsers()
    const plans = await getUsersPlansByIds(authUsers.map(user => user.id))

    return authUsers.map(user => toAdminUser(user, (plans[user.id] as Plan) || 'beginner'))
}

export async function getAllUsers() {
    await requireAdmin()
    return listUsers()
}

export async function getAdminOverview(): Promise<AdminOverview> {
    await requireAdmin()

    const users = await listUsers()
    const now = momentSH()
    const weekAgo = now.clone().subtract(7, 'days')
    const monthAgo = now.clone().subtract(30, 'days')

    const planCounts = PLANS.reduce(
        (acc, plan) => {
            acc[plan] = 0
            return acc
        },
        {} as Record<Plan, number>,
    )

    const dayBuckets = new Map<string, number>()
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
        dayBuckets.set(now.clone().subtract(i, 'days').format('YYYY-MM-DD'), 0)
    }

    let activeUsers = 0
    let newThisWeek = 0
    let newThisMonth = 0
    let verifiedUsers = 0

    for (const user of users) {
        planCounts[user.plan]++

        if (user.emailConfirmedAt) verifiedUsers++

        if (user.lastSignInAt && momentSH(user.lastSignInAt).isAfter(monthAgo)) {
            activeUsers++
        }

        if (user.createdAt) {
            const createdAt = momentSH(user.createdAt)
            if (createdAt.isAfter(weekAgo)) newThisWeek++
            if (createdAt.isAfter(monthAgo)) newThisMonth++

            const dayKey = createdAt.format('YYYY-MM-DD')
            if (dayBuckets.has(dayKey)) {
                dayBuckets.set(dayKey, dayBuckets.get(dayKey)! + 1)
            }
        }
    }

    const signupsByDay = Array.from(dayBuckets.entries()).map(([date, signups]) => ({
        date: momentSH(date).format('MMM D'),
        signups,
    }))

    const recentUsers = [...users]
        .filter(user => user.createdAt)
        .sort((a, b) => momentSH(b.createdAt!).valueOf() - momentSH(a.createdAt!).valueOf())
        .slice(0, 6)

    return {
        totalUsers: users.length,
        activeUsers,
        newThisWeek,
        newThisMonth,
        paidUsers: users.length - planCounts.beginner,
        verifiedUsers,
        planCounts,
        signupsByDay,
        recentUsers,
    }
}
