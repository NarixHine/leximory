'use server'

import { getXataClient } from '@/lib/xata'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

export default async function saveSubs(subs: PushSubscription) {
    const xata = getXataClient()
    const { userId } = await auth()
    if (userId) {
        await xata.db.subs.create({
            uid: (await auth()).userId,
            subscription: subs
        })
        revalidatePath(`/daily`)
    }
}

export async function delSubs() {
    const xata = getXataClient()
    const { userId } = await auth()
    if (userId) {
        const rec = await xata.db.subs.filter({
            uid: (await auth()).userId,
        }).getFirstOrThrow()
        await rec.delete()
        revalidatePath(`/daily`)
    }
}
