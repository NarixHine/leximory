import { getPlanFromProductId } from '@/lib/config'
import { createWebhookHandler } from '@/lib/creem-sdk/webhook-handler'
import env from '@/lib/env'
import { logsnagServer } from '@/lib/logsnag'
import { creem } from '@/server/client/creem'
import { getRequestUserId, fillCustomerId, getUserIdByCustomerId, toggleOrgCreationAccess, updateSubscription } from '@/server/db/creem'
import { after, NextRequest, NextResponse } from 'next/server'

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
        await toggleOrgCreationAccess({ userId, enabled: plan === 'polyglot' })

        after(async () => {
            const logsnag = logsnagServer()
            await logsnag.track({
                event: '订阅升级',
                channel: 'payments',
                icon: '💰',
                description: `订阅升级为 ${plan}`,
                user_id: userId,
            })
        })
    },

    'subscription.expired': async (event) => {
        const { customer } = event.object
        const userId = await getUserIdByCustomerId(customer.id)
        await updateSubscription({ userId, plan: 'beginner' })
        await toggleOrgCreationAccess({ userId, enabled: false })
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
