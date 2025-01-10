import 'server-only'

import { getXataClient } from '@/lib/xata'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

const xata = getXataClient()

export async function getSubsStatus({ userId }: { userId: string }) {
    return !!(await xata.db.subs.filter({ uid: userId }).getFirst())
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
