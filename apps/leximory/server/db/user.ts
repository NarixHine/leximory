import 'server-only'
import type { Plan } from '@repo/env/config'
import { getMemberships } from '@repo/user/membership'

export async function getUsersPlansByIds(userIds: string[]): Promise<Record<string, Plan>> {
    const memberships = await getMemberships(userIds)
    return Object.fromEntries([...memberships].map(([id, membership]) => [id, membership.plan]))
}
