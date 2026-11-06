import 'server-only'
import type { WorkflowContext } from '@upstash/workflow'
import { supabase } from '@repo/supabase'
import { appleEnvironment } from '@repo/user/entitlements'
import { appleConfigured, appleNotification, appleNotificationHistory } from '../billing/apple'
import { appleBilling } from '../billing/store'
import { AppleBillingError } from '../billing/service'
import { publishAppleSubscription } from './client'

export async function reconcileAppleSubscription(
    context: WorkflowContext<{ environment: 'Production' | 'Sandbox'; chain: string }>,
) {
    await context.run('reconcile-subscription', async () => {
        try {
            await appleBilling.reconcile(context.requestPayload.environment, context.requestPayload.chain)
        } catch (error) {
            if (error instanceof AppleBillingError && error.reason === 'owner') return
            throw error
        }
    })
}
export async function recoverAppleSubscriptions(context: WorkflowContext<unknown>) {
    const step = context
    if (!(await step.run('configured', () => appleConfigured()))) return { enabled: false }
    // Re-fetch known chains, including expired chains whose refunds or billing status may have changed.
    let offset = 0
    while (true) {
        const rows = await step.run(`chains-${offset}`, async () => {
            const { data } = await supabase
                .from('apple_subscriptions')
                .select('environment,original_transaction_id')
                .not('user_id', 'is', null)
                .order('environment')
                .order('original_transaction_id')
                .range(offset, offset + 199)
                .throwOnError()
            return data.map((row) => ({
                environment: appleEnvironment.parse(row.environment),
                chain: row.original_transaction_id,
            }))
        })
        if (rows.length)
            await step.run(`reconcile-${offset}`, () =>
                Promise.all(
                    rows.map((row) =>
                        publishAppleSubscription(
                            row,
                            `apple-recovery:${context.workflowRunId}:${row.environment}:${row.chain}`,
                        ),
                    ),
                ),
            )
        if (rows.length < 200) break
        offset += 200
    }
    const end = await step.run('history-window', () => Date.now())
    // An overlapping window recovers missed first purchases as well as renewal notifications.
    for (const environment of ['Production', 'Sandbox'] as const) {
        let cursor: string | null = null
        for (let page = 0; ; page++) {
            const batch = await step.run(`history-${environment}-${page}`, async () => {
                const history = await appleNotificationHistory(environment, end - 48 * 3600000, end, cursor)
                const events: { data: Parameters<typeof publishAppleSubscription>[0]; id: string }[] = []
                for (const item of history.notificationHistory ?? []) {
                    if (!item.signedPayload) throw new AppleBillingError('unavailable')
                    const notification = await appleNotification(item.signedPayload)
                    if (notification.environment !== environment) throw new AppleBillingError('invalid')
                    if (notification.chain)
                        events.push({
                            data: { environment, chain: notification.chain },
                            id: `apple:${environment}:${notification.id}`,
                        })
                }
                if (history.hasMore && !history.paginationToken) throw new AppleBillingError('unavailable')
                // Persist no signed payloads in workflow step output.
                return { events, cursor: history.paginationToken ?? null, hasMore: history.hasMore ?? false }
            })
            if (batch.events.length)
                await step.run(`recover-${environment}-${page}`, () =>
                    Promise.all(batch.events.map((event) => publishAppleSubscription(event.data, event.id))),
                )
            if (!batch.hasMore) break
            cursor = batch.cursor
        }
    }
    return { enabled: true }
}
