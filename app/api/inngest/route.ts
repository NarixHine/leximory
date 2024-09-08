import { inngest } from '@/inngest/client'
import { fanNotification, notify } from '@/inngest/notify'
import { serve } from 'inngest/next'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    fanNotification,
    notify
  ],
})
