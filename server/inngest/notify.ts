import { GetEvents } from 'inngest'
import { inngest } from './client'
import webpush from 'web-push'
import { prefixUrl } from '@/lib/config'
import env from '@/lib/env'
import { getHourlySubs } from '@/server/db/subs'
import moment from 'moment-timezone'

type Events = GetEvents<typeof inngest>

webpush.setVapidDetails(
    env.NEXT_PUBLIC_URL!,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!
)

export const fanNotification = inngest.createFunction(
    { id: 'load-subscribed-users' },
    { cron: 'TZ=Asia/Shanghai 0 * * * *' },
    async ({ step }) => {
        const users = await step.run('fetch-users', async () => {
            const hour = moment().tz('Asia/Shanghai').hour()
            const subs = await getHourlySubs(hour)
            return subs.map(({ uid, subscription }) => ({ uid, subscription }))
        })

        const events = users.map<Events['app/notify']>(
            ({ subscription, uid }) => ({
                name: 'app/notify',
                data: {
                    subscription,
                },
                user: uid,
            })
        )

        await step.sendEvent('fan-out-notifications', events)
    }
)

export const notify = inngest.createFunction(
    { id: 'notify' },
    { event: 'app/notify' },
    async ({ event }) => {
        const subscription = event.data.subscription
        await webpush.sendNotification(subscription, JSON.stringify({
            title: 'Leximory 日报',
            body: '回顾今日、昨日、四日前、七日前记忆的语汇。',
            icon: prefixUrl('/android-chrome-192x192.png'),
            data: {
                url: prefixUrl('/daily')
            },
        }))
    }
)
