import { cron } from 'inngest'
import { cleanExpiredEbookUploads } from '@/server/mobile/ebook-staging-store'
import { inngest } from './client'

export const cleanEbookUploads = inngest.createFunction(
    { id: 'clean-mobile-ebook-uploads', triggers: [cron('15 * * * *')] },
    async ({ step }) => {
        const cutoff = await step.run('cutoff', () => Date.now())
        for (let batch = 0; batch < 100; batch++) {
            const removed = await step.run('remove-' + batch, () => cleanExpiredEbookUploads(cutoff))
            if (removed < 100) break
        }
    },
)
