import { annotateFullArticle } from '@/server/inngest/annotate'
import { inngest } from '@/server/inngest/client'
import { fanNotification, notify } from '@/server/inngest/notify'
import { serve } from 'inngest/next'
import { generateStory } from '@/server/inngest/story'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    fanNotification,
    notify,
    annotateFullArticle,
    generateStory
  ],
})
