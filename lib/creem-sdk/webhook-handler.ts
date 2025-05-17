import { CreemSDK } from './index'
import {
    CheckoutCompletedEvent,
    RefundCreatedEvent,
    SubscriptionActiveEvent,
    SubscriptionCanceledEvent,
    SubscriptionExpiredEvent,
    SubscriptionPaidEvent,
    WebhookEvent,
    WebhookHandlers
} from './types'

/**
 * Type guard to check if event is a checkout completed event
 */
function isCheckoutCompleted(event: WebhookEvent): event is CheckoutCompletedEvent {
    return event.eventType === 'checkout.completed'
}

/**
 * Type guard to check if event is a subscription active event
 */
function isSubscriptionActive(event: WebhookEvent): event is SubscriptionActiveEvent {
    return event.eventType === 'subscription.active'
}

/**
 * Type guard to check if event is a subscription paid event
 */
function isSubscriptionPaid(event: WebhookEvent): event is SubscriptionPaidEvent {
    return event.eventType === 'subscription.paid'
}

/**
 * Type guard to check if event is a subscription canceled event
 */
function isSubscriptionCanceled(event: WebhookEvent): event is SubscriptionCanceledEvent {
    return event.eventType === 'subscription.canceled'
}

/**
 * Type guard to check if event is a subscription expired event
 */
function isSubscriptionExpired(event: WebhookEvent): event is SubscriptionExpiredEvent {
    return event.eventType === 'subscription.expired'
}

/**
 * Type guard to check if event is a refund created event
 */
function isRefundCreated(event: WebhookEvent): event is RefundCreatedEvent {
    return event.eventType === 'refund.created'
}

/**
 * Creates a webhook handler for processing Creem webhook events
 * @param {CreemSDK} creem - Instance of CreemSDK
 * @param {string} webhookSecret - Your webhook secret from the Creem dashboard
 * @param {WebhookHandlers} handlers - Map of event type handlers
 * @returns {(req: NextApiRequest, res: NextApiResponse) => Promise<void>} Express/Next.js middleware function
 * @see https://docs.creem.io/learn/webhooks/introduction
 * @example
 * const webhookHandler = createWebhookHandler(
 *   creemSDK,
 *   'your_webhook_secret',
 *   {
 *     'checkout.completed': async (event) => {
 *       const { order, customer } = event.object;
 *       await updateOrder(order.id);
 *     },
 *     'subscription.paid': async (event) => {
 *       const { transaction, subscription } = event.object;
 *       await activateAccess(subscription.id);
 *     }
 *   }
 * );
 */
export function createWebhookHandler(
    creem: CreemSDK,
    webhookSecret: string,
    handlers: WebhookHandlers
) {
    return async function handler(req: any, res: any) {
        if (req.method !== 'POST') {
            return res.json({ message: 'Method not allowed' }, { status: 405 })
        }

        const signature = req.headers['creem-signature'] as string
        if (!signature) {
            return res.json({ message: 'No signature found' }, { status: 400 })
        }

        const payload = JSON.stringify(req.body)
        const isValid = creem.verifyWebhookSignature(payload, signature, webhookSecret)

        if (!isValid) {
            return res.json({ message: 'Invalid signature' }, { status: 400 })
        }

        const event = req.body as WebhookEvent

        try {
            switch (event.eventType) {
                case 'checkout.completed':
                    if (handlers['checkout.completed'] && isCheckoutCompleted(event)) {
                        await handlers['checkout.completed'](event)
                    }
                    break
                case 'subscription.active':
                    if (handlers['subscription.active'] && isSubscriptionActive(event)) {
                        await handlers['subscription.active'](event)
                    }
                    break
                case 'subscription.paid':
                    if (handlers['subscription.paid'] && isSubscriptionPaid(event)) {
                        await handlers['subscription.paid'](event)
                    }
                    break
                case 'subscription.canceled':
                    if (handlers['subscription.canceled'] && isSubscriptionCanceled(event)) {
                        await handlers['subscription.canceled'](event)
                    }
                    break
                case 'subscription.expired':
                    if (handlers['subscription.expired'] && isSubscriptionExpired(event)) {
                        await handlers['subscription.expired'](event)
                    }
                    break
                case 'refund.created':
                    if (handlers['refund.created'] && isRefundCreated(event)) {
                        await handlers['refund.created'](event)
                    }
                    break
                default:
                    return res.json({ message: `Unhandled event type: ${event}` }, { status: 400 })
            }

            return res.json({ received: true }, { status: 200 })
        } catch (error) {
            return res.json({ message: 'Webhook handler failed' }, { status: 500 })
        }
    }
} 