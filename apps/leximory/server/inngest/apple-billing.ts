import { cron } from 'inngest'
import { supabase } from '@repo/supabase'
import { appleEnvironment } from '@repo/user/entitlements'
import { inngest, appleSubscriptionChanged } from './client'
import { appleConfigured, appleNotification, appleNotificationHistory } from '../billing/apple'
import { appleBilling } from '../billing/store'
import { AppleBillingError } from '../billing/service'

export const reconcileAppleSubscription = inngest.createFunction(
    {
        id: 'apple-subscription',
        retries: 8,
        concurrency: { limit: 1, key: 'event.data.environment + ":" + event.data.chain' },
        triggers: [appleSubscriptionChanged],
    },
    async ({ event }) => {
        try {
            await appleBilling.reconcile(event.data.environment, event.data.chain)
        } catch (error) {
            // Deleted owners and Sandbox users outside the test cohort cannot gain access.
            if (error instanceof AppleBillingError && error.reason === 'owner') return { ignored: true }
            throw error
        }
        return { reconciled: true }
    },
)

export const recoverAppleSubscriptions = inngest.createFunction(
    { id: 'apple-subscription-recovery', retries: 5, concurrency: 1, triggers: [cron('17 * * * *')] },
    async ({ step }) => {
        if (!appleConfigured()) return { enabled: false }
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
                await step.sendEvent(
                    `reconcile-${offset}`,
                    rows.map((row) => appleSubscriptionChanged.create(row)),
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
                    const events = []
                    for (const item of history.notificationHistory ?? []) {
                        if (!item.signedPayload) throw new AppleBillingError('unavailable')
                        const notification = await appleNotification(item.signedPayload)
                        if (notification.environment !== environment) throw new AppleBillingError('invalid')
                        if (notification.chain)
                            events.push({
                                ...appleSubscriptionChanged.create({ environment, chain: notification.chain }),
                                id: `apple:${environment}:${notification.id}`,
                            })
                    }
                    if (history.hasMore && !history.paginationToken) throw new AppleBillingError('unavailable')
                    // Persist no signed payloads in Inngest step output.
                    return { events, cursor: history.paginationToken ?? null, hasMore: history.hasMore ?? false }
                })
                if (batch.events.length) await step.sendEvent(`recover-${environment}-${page}`, batch.events)
                if (!batch.hasMore) break
                cursor = batch.cursor
            }
        }
        return { enabled: true }
    },
)
