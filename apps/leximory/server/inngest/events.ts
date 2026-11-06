import { eventType, staticSchema } from 'inngest'

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

import { articleImportEventSchema } from '../workflows/contracts'
export { articleImportEventSchema } from '../workflows/contracts'

export const notifyEvent = eventType('app/notify', {
    schema: staticSchema<NotifyUser>(),
})

export const articleImported = eventType('app/article.imported', {
    schema: articleImportEventSchema,
})
