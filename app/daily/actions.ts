'use server'

import { getAuthOrThrow } from '@/server/auth/role'
import saveSubs, { delSubs } from '@/server/db/subs'
import { PushSubscription } from 'web-push'

export async function save({ subs, hour }: { subs: PushSubscription, hour: number }) {
    const { userId } = await getAuthOrThrow()
    await saveSubs({ userId, subs, hour })
}

export async function remove() {
    const { userId } = await getAuthOrThrow()
    await delSubs({ userId })
}
