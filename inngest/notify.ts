import { GetEvents } from 'inngest'
import { inngest } from './client'
import webpush from 'web-push'
import { prefixUrl } from '@/lib/config'
import env from '@/lib/env'
import { getAllSubs } from '@/server/subs'

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
            return await getAllSubs()
        })

        const events = users.map<Events['app/notify']>(
            (user) => ({
                name: 'app/notify',
                data: {
                    subscription: user.subscription,
                },
                user: user.uid,
            })
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
