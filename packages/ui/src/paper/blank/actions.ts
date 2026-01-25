'use server'

import { streamExplanation, StreamExplanationParams } from '@/server/ai/ask'
import { ACTION_QUOTA_COST } from '@repo/env/config'
import { incrCommentaryQuota } from '@repo/user/quota'

export async function streamExplanationAction(params: StreamExplanationParams) {
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.pouncepen.ask)) {
        throw new Error('You have reached your commentary quota limit.')
    }
    return streamExplanation(params)
}
