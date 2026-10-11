import 'server-only'
import { supabase } from '@repo/supabase'
import { Plan } from '@repo/env/config'

const USER_PLANS_BATCH_SIZE = 100

export async function getUsersPlansByIds(userIds: string[]): Promise<Record<string, Plan>> {
    const plans: Record<string, Plan> = {}

    for (let offset = 0; offset < userIds.length; offset += USER_PLANS_BATCH_SIZE) {
        const ids = userIds.slice(offset, offset + USER_PLANS_BATCH_SIZE)
        const { data: users, error } = await supabase.from('users').select('id, plan').in('id', ids)

        if (error) {
            throw new Error(`Failed to fetch user plans: ${error.message}`)
        }

        for (const user of users) {
            plans[user.id] = (user.plan || 'beginner') as Plan
        }
    }

    return plans
}
