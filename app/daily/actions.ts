'use server'

import { getAuthOrThrow } from '@/lib/auth'
import saveSubs, { delSubs } from '@/server/subs'
import { PushSubscription } from 'web-push'

export async function save(subscription: PushSubscription) {
    const { userId } = await getAuthOrThrow()
    await saveSubs({ userId, subs: subscription })
}

export async function remove() {
    const { userId } = await getAuthOrThrow()
    await delSubs({ userId })
}
