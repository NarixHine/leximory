import { inngest } from '@/server/inngest/client'
import { fanNotification, notify } from '@/server/inngest/notify'
import { serve } from 'inngest/next'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    fanNotification,
    notify
  ],
})
