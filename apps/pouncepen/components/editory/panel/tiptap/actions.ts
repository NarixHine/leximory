'use server'

import { streamQuiz } from '@/server/ai/generate-quiz'
import incrCommentaryQuota from '@repo/user/quota'
import { ACTION_QUOTA_COST } from '@repo/env/config'
import { AIGeneratableType } from '@repo/ui/paper/utils'

export async function streamQuizAction({ prompt, type }: { prompt: string, type: AIGeneratableType }) {
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.pouncepen.genQuiz)) {
        throw new Error('You have reached your commentary quota limit.')
    }
    return streamQuiz({ prompt, type })
}