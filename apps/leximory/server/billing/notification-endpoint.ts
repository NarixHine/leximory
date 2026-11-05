import 'server-only'
import { publishEvent } from '../inngest/client'
import { appleSubscriptionChanged } from '../inngest/events'
import { appleNotification } from './apple'
import { createAppleNotificationHandler } from './notifications'

export const receiveAppleNotification = createAppleNotificationHandler({
    verify: appleNotification,
    async enqueue({ id, environment, chain }) {
        await publishEvent({
            ...appleSubscriptionChanged.create({ environment, chain }),
            id: `apple:${environment}:${id}`,
        })
    },
})
