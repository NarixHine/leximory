'use server'

import { getAuthOrThrow } from '@/lib/auth'
import saveSubs, { delSubs } from '@/server/db/subs'
import { PushSubscription } from 'web-push'

export async function save(subs: PushSubscription) {
    const { userId } = await getAuthOrThrow()
    await saveSubs({ userId, subs })
}

export async function remove() {
    const { userId } = await getAuthOrThrow()
    await delSubs({ userId })
}
