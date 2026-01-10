import { getPlanFromProductId } from '@/lib/config'
import { createWebhookHandler } from '@/lib/creem-sdk/webhook-handler'
import env from '@/lib/env'
import { creem } from '@/server/client/creem'
import { getRequestUserId, fillCustomerId, getUserIdByCustomerId, updateSubscription } from '@/server/db/creem'
import { NextRequest, NextResponse } from 'next/server'

const webhookHandler = createWebhookHandler(creem, env.CREEM_WEBHOOK_SECRET, {
    'checkout.completed': async (event) => {
        const { request_id, customer, subscription, product } = event.object
        if (!request_id || subscription?.status !== 'active') {
            return
        }
        const userId = await getRequestUserId(request_id)
        await fillCustomerId({ userId, customerId: customer.id })
        const plan = getPlanFromProductId(product.id)
        await updateSubscription({ userId, plan })
    },

    'subscription.expired': async (event) => {
        const { customer } = event.object
        const userId = await getUserIdByCustomerId(customer.id)
        await updateSubscription({ userId, plan: 'beginner' })
    }
})

export async function POST(req: NextRequest) {
    const request = {
        method: req.method,
        headers: Object.fromEntries(req.headers),
        body: await req.json()
    }
    const response = await webhookHandler(request, {
        json: (data: any, init?: { status?: number }) =>
            NextResponse.json(data, { status: init?.status || 200 })
    })
    return response
} 
