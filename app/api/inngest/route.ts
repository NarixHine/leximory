import { annotateFullArticle } from '@/server/inngest/annotate'
import { inngest } from '@/server/inngest/client'
import { fanNotification, notify } from '@/server/inngest/notify'
import { serve } from 'inngest/next'
import { generateStory } from '@/server/inngest/story'
import { generateTimes, triggerGenerateTimes, triggerRegenerateTimes } from '@/server/inngest/times'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    fanNotification,
    notify,
    annotateFullArticle,
    generateStory,
    triggerGenerateTimes,
    triggerRegenerateTimes,
    generateTimes
  ],
})
