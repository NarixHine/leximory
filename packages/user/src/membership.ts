import 'server-only'
import { supabase } from '@repo/supabase'
import env from '@repo/env'
import { appleSnapshot, resolveMembership } from './entitlements'

export function allowsAppleSandbox(userId: string) {
    return (env.APPLE_SANDBOX_USER_IDS ?? '').split(',').some((id) => id.trim().toLowerCase() === userId.toLowerCase())
}
export async function getMemberships(userIds: string[], signal?: AbortSignal) {
    const memberships = new Map<string, ReturnType<typeof resolveMembership>>()
    for (let offset = 0; offset < userIds.length; offset += 100) {
        const ids = userIds.slice(offset, offset + 100)
        let profiles = supabase.from('users').select('id,plan').in('id', ids)
        let subscriptions = supabase.from('apple_subscriptions').select('*').in('user_id', ids)
        if (signal) {
            profiles = profiles.abortSignal(signal)
            subscriptions = subscriptions.abortSignal(signal)
        }
        const [{ data: users }, { data: rows }] = await Promise.all([
            profiles.throwOnError(),
            subscriptions.throwOnError(),
        ])
        const snapshots = rows.map((row) => {
            const parsed = appleSnapshot.safeParse(row)
            if (!parsed.success) throw new Error('Invalid stored Apple snapshot')
            return parsed.data
        })
        for (const userId of ids)
            memberships.set(
                userId,
                resolveMembership({
                    userId,
                    legacyPlan: users.find((user) => user.id === userId)?.plan,
                    snapshots: snapshots.filter((row) => row.user_id === userId),
                    sandboxAllowed: allowsAppleSandbox(userId),
                }),
            )
    }
    return memberships
}
export async function getMembership(userId: string, signal?: AbortSignal) {
    const membership = (await getMemberships([userId], signal)).get(userId)
    if (!membership) throw new Error('Membership unavailable')
    return membership
}
