import { GetEvents } from 'inngest'
import { inngest } from './client'
import { getXataClient } from '@/lib/xata'
import webpush, { PushSubscription } from 'web-push'
import { prefixUrl } from '@/lib/config'
import env from '@/lib/env'

type Events = GetEvents<typeof inngest>

webpush.setVapidDetails(
    env.NEXT_PUBLIC_URL!,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!
)

export const fanNotification = inngest.createFunction(
    { id: 'load-subscribed-users' },
    { cron: 'TZ=Asia/Shanghai 30 21 * * *' },
    async ({ step }) => {
        const users = await step.run('fetch-users', async () => {
            const xata = getXataClient()
            return xata.db.subs.select(['uid', 'subscription']).getAll()
        })

        const events = users.map<Events['app/notify']>(
            (user) => {
                return {
                    name: 'app/notify',
                    data: {
                        subscription: user.subscription as PushSubscription,
                    },
                    user,
                }
            }
        )

        await step.sendEvent('fan-out-notifications', events)
    }
)

export const notify = inngest.createFunction(
    { id: 'notify' },
    { event: 'app/notify' },
    async ({ event }) => {
        const { subscription } = event.data
        webpush.sendNotification(subscription, JSON.stringify({
            title: 'Leximory 日报',
            body: '回顾今日、昨日、四日前、七日前记忆的语汇。',
            icon: '/android-chrome-192x192.png',
            data: {
                url: prefixUrl('/daily')
            },
        }))
    }
)
