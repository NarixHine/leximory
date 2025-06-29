import { Suspense } from 'react'
import { supabase } from '@/server/client/supabase'
import { getUsersPlansByIds } from '@/server/db/user'
import { requireAdmin } from '@/server/auth/role'
import { Plan } from '@/lib/config'
import AdminOverview from './components/overview'
import UsersList from './components/user-list'
import RegenerateTimesButton from './components/regenerate-times'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { Spinner } from '@heroui/spinner'

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
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
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
        username: user.user_metadata?.username || 'N/A',
        plan: userPlans[user.id] || 'beginner',
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
        emailConfirmedAt: user.email_confirmed_at,
        avatarUrl: user.user_metadata?.avatar_url,
    }))
}


export default async function AdminPage() {
    const [overview, users] = await Promise.all([
        getUsersOverview(),
        getAllUsers()
    ])

    return (
        <div className='flex flex-col gap-6'>
            {/* Top Grid Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* System Overview - Takes 2 columns */}
                <div>
                    <AdminOverview overview={overview} />
                </div>

                {/* Quick Actions Card */}
                <div>
                    <Card className='h-full p-4' shadow='sm'>
                        <CardHeader className='pb-3'>
                            <h3 className='text-lg'>Quick Actions</h3>
                        </CardHeader>
                        <CardBody className='pt-0'>
                            <RegenerateTimesButton />
                        </CardBody>
                    </Card>
                </div>
            </div>

            <Suspense fallback={
                <div className='flex justify-center items-center p-12'>
                    <Spinner size='lg' />
                </div>
            }>
                <UsersList users={users} />
            </Suspense>
        </div>
    )
}