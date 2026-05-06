import { Client } from '@upstash/workflow'
import env from '@repo/env'
import { prefixUrl } from '@repo/env/config'

interface TriggerStoryWorkflowParams {
    date: string
    lang: string
    userId: string
    storyStyle?: string
    progressKey: string
}

const workflowClient = new Client({ token: env.QSTASH_TOKEN })

export async function generateStory({ date, lang, userId, storyStyle, progressKey }: TriggerStoryWorkflowParams) {

    const { workflowRunId } = await workflowClient.trigger({
        url: prefixUrl('/api/review/workflow'),
        body: { date, lang, userId, storyStyle, progressKey },
        retries: 2,
    })

    return { workflowRunId }
}
