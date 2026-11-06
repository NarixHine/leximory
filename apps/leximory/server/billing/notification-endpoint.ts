import 'server-only'
import { publishAppleSubscription } from '../workflows/client'
import { appleNotification } from './apple'
import { createAppleNotificationHandler } from './notifications'

export const receiveAppleNotification = createAppleNotificationHandler({
    verify: appleNotification,
    async enqueue({ id, environment, chain }) {
        await publishAppleSubscription({ environment, chain }, `apple:${environment}:${id}`)
    },
})
