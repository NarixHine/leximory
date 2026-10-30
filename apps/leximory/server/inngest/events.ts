import { eventType, staticSchema } from 'inngest'
import { z } from 'zod'

type NotifyUser =
    | {
          title: string
          body: string
          url: string
          subscription: string
          uid: string
      }
    | {
          title: string
          body: string
          url: string
          subscription: null
          uid: string
      }

export const articleImportEventSchema = z
    .object({
        article: z.string().min(1).max(30000),
        textId: z.string().min(1).max(128),
        onlyComments: z.boolean(),
        userId: z.string().min(1).max(128),
        generateTitle: z.boolean().optional(),
    })
    .strict()

export const notifyEvent = eventType('app/notify', {
    schema: staticSchema<NotifyUser>(),
})

export const articleImported = eventType('app/article.imported', {
    schema: articleImportEventSchema,
})

export const appleSubscriptionChanged = eventType('app/apple.subscription.changed', {
    schema: staticSchema<{ environment: 'Production' | 'Sandbox'; chain: string }>(),
})
