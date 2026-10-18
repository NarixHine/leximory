import { reconcileAppleSubscription, recoverAppleSubscriptions } from '@/server/inngest/apple-billing'
import { annotateFullArticle } from '@/server/inngest/annotate'
import { inngest } from '@/server/inngest/client'
import { fanNotification, notify } from '@/server/inngest/notify'
import { serve } from 'inngest/next'

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [fanNotification, notify, annotateFullArticle, reconcileAppleSubscription, recoverAppleSubscriptions],
})
