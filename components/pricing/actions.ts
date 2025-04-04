'use server'

import { createRequest } from '@/server/db/creem'
import { redirect } from 'next/navigation'
import { creemProductIdMap, PaidTier, prefixUrl } from '@/lib/config'
import { creem } from '@/server/client/creem'
import { auth } from '@clerk/nextjs/server'

export async function upgrade({ plan }: { plan: PaidTier }) {
    const { userId } = await auth()
    if (!userId) {
        redirect('/sign-in')
    }
    const session = await creem.createCheckoutSession({
        success_url: prefixUrl('/settings'),
        product_id: creemProductIdMap[plan],
        request_id: await createRequest(userId),
    })
    redirect(session.checkout_url)
}