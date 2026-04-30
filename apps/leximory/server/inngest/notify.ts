import { cron } from 'inngest'
import { inngest, notifyEvent } from './client'
import webpush from 'web-push'
import { prefixUrl } from '@repo/env/config'
import env from '@repo/env'
import { getHourlySubs } from '@/server/db/subs'
import { momentSH } from '@/lib/moment'

webpush.setVapidDetails(
    env.NEXT_PUBLIC_LEXIMORY_URL,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
)

export const fanNotification = inngest.createFunction(
    { id: 'load-subscribed-users', triggers: [cron('TZ=Asia/Shanghai 0 * * * *')] },
    async ({ step }) => {
        const users = await step.run('fetch-users', async () => {
            const hour = momentSH().hour()
            const subs = await getHourlySubs(hour)
            return subs.map(({ uid, subscription }) => ({ uid, subscription }))
        })

        const events = users
            .filter((u): u is { uid: string; subscription: Exclude<typeof u.subscription, null> } => Boolean(u.subscription))
            .map(({ subscription, uid }) => notifyEvent.create({
                title: '今日词汇复盘',
                body: '📝 回顾你最近在 Leximory 上学习的语汇',
                url: prefixUrl('/review'),
                subscription: JSON.stringify(subscription),
                uid,
            }))

        await step.sendEvent('fan-out-notifications', events)
    }
)

export const notify = inngest.createFunction(
    { id: 'notify', triggers: [notifyEvent] },
    async ({ event }) => {
        const { title, body, url, subscription, uid: _uid } = event.data
        if (!subscription) return
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
