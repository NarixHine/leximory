'use server'

import { createRequest } from '@/server/db/creem'
import { redirect } from 'next/navigation'
import { CREEM_PRODUCT_ID, PaidTier, prefixUrl, SIGN_IN_URL } from '@repo/env/config'
import { creem } from '@/server/client/creem'
import { getUserOrThrow } from '@repo/user'

export async function upgrade({ plan }: { plan: PaidTier }) {
    const { userId } = await getUserOrThrow()
    if (!userId) {
        redirect(SIGN_IN_URL)
    }
    const session = await creem.createCheckoutSession({
        success_url: prefixUrl('/settings'),
        product_id: CREEM_PRODUCT_ID[plan],
        request_id: await createRequest(userId),
    })
    redirect(session.checkout_url)
}