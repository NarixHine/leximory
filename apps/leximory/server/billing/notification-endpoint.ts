import 'server-only'
import { inngest, appleSubscriptionChanged } from '../inngest/client'
import { appleNotification } from './apple'
import { createAppleNotificationHandler } from './notifications'

export const receiveAppleNotification = createAppleNotificationHandler({
    verify: appleNotification,
    async enqueue({ id, environment, chain }) {
        await inngest.send({
            ...appleSubscriptionChanged.create({ environment, chain }),
            id: `apple:${environment}:${id}`,
        })
    },
})
