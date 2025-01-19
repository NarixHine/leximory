import 'server-only'

import { getXataClient } from '@/server/client/xata'
import { PushSubscription } from 'web-push'
import { revalidatePath } from 'next/cache'

const xata = getXataClient()

export async function getSubsStatus({ userId }: { userId: string }) {
    const subs = await xata.db.subs.filter({ uid: userId }).getFirst()
    return { hasSubs: !!subs, hour: subs?.hour, subscription: JSON.stringify(subs?.subscription) }
}

export async function getHourlySubs(hour: number) {
    const subs = await xata.db.subs.select(['uid', 'subscription']).filter({ hour }).getAll()
    return subs.map(({ uid, subscription }) => ({ uid, subscription: subscription as PushSubscription }))
}

export default async function saveSubs({ userId, subs, hour }: { userId: string, subs: PushSubscription, hour: number }) {
    await xata.db.subs.create({
        uid: userId,
        subscription: subs,
        hour
    })
    revalidatePath(`/daily`)
}

export async function delSubs({ userId }: { userId: string }) {
    const rec = await xata.db.subs.filter({
        uid: userId,
    }).getFirstOrThrow()
    await rec.delete()
    revalidatePath(`/daily`)
}
