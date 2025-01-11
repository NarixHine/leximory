import 'server-only'

import { getXataClient } from '@/lib/xata'
import { revalidatePath } from 'next/cache'
import { PushSubscription } from 'web-push'

const xata = getXataClient()

export async function getSubsStatus({ userId }: { userId: string }) {
    return !!(await xata.db.subs.filter({ uid: userId }).getFirst())
}

export async function getAllSubs() {
    const subs = await xata.db.subs.select(['uid', 'subscription']).getAll()
    return subs.map(({ uid, subscription }) => ({ uid, subscription: subscription as PushSubscription }))
}

export default async function saveSubs({ userId, subs }: { userId: string, subs: PushSubscription }) {
    await xata.db.subs.create({
        uid: userId,
        subscription: subs
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
