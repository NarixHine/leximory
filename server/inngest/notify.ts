import { GetEvents } from 'inngest'
import { inngest } from './client'
import webpush from 'web-push'
import { prefixUrl } from '@/lib/config'
import env from '@/lib/env'
import { getHourlySubs } from '@/server/db/subs'
import { momentSH } from '@/lib/moment'

type Events = GetEvents<typeof inngest>

webpush.setVapidDetails(
    env.NEXT_PUBLIC_URL,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
)

export const fanNotification = inngest.createFunction(
    { id: 'load-subscribed-users' },
    { cron: 'TZ=Asia/Shanghai 0 * * * *' },
    async ({ step }) => {
        const users = await step.run('fetch-users', async () => {
            const hour = momentSH().hour()
            const subs = await getHourlySubs(hour)
            return subs.map(({ uid, subscription }) => ({ uid, subscription }))
        })

        const events = users.map<Events['app/notify']>(
            ({ subscription, uid }) => ({
                name: 'app/notify',
                data: {
                    title: '今日词汇复盘',
                    body: '📝 回顾你最近在 Leximory 上学习的语汇',
                    url: prefixUrl('/daily'),
                    subscription: JSON.stringify(subscription),
                },
                user: { uid },
            })
        )

        await step.sendEvent('fan-out-notifications', events)
    }
)

export const notify = inngest.createFunction(
    { id: 'notify' },
    { event: 'app/notify' },
    async ({ event }) => {
        const { title, body, url, subscription } = event.data
        const subs = JSON.parse(subscription)
        await webpush.sendNotification(subs, JSON.stringify({
            title,
            body,
            icon: prefixUrl('/android-chrome-192x192.png'),
            data: {
                url
            },
        }))
    }
)
