import 'server-only'
import webpush from 'web-push'
import env from '@repo/env'
import { prefixUrl } from '@repo/env/config'
import { isUserActive } from '@repo/supabase/user'
import { getSubsStatus } from '../db/subs'

export async function notifyArticleImported(userId: string, textUrl: string) {
    if (!(await isUserActive(userId))) return
    const { hasSubs, subscription } = await getSubsStatus({ userId })
    if (!hasSubs || !subscription) return
    webpush.setVapidDetails(env.NEXT_PUBLIC_LEXIMORY_URL, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)
    await webpush.sendNotification(
        JSON.parse(subscription),
        JSON.stringify({
            title: 'Leximory',
            body: '😎 导入文章注解完毕啦！',
            icon: prefixUrl('/android-chrome-192x192.png'),
            data: { url: prefixUrl(textUrl) },
        }),
    )
}
