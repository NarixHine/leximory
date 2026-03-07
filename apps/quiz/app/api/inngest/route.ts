import { inngest } from '@/server/inngest/client'
import { markSubjectiveSections } from '@/server/inngest/marking'
import { serve } from 'inngest/next'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    markSubjectiveSections,
  ],
})
