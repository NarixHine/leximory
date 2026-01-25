'use server'

import { compareAnswers, pilotPaper } from '@/server/ai/fix'
import { QuizData } from '../../../../../../packages/ui/src/paper/types'
import { incrCommentaryQuota } from '@repo/user/quota'
import { ACTION_QUOTA_COST } from '@repo/env/config'

export async function streamAnsweraAction(questionGroup: QuizData) {
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.pouncepen.answer)) {
        throw new Error('You have reached your commentary quota limit.')
    }
    return pilotPaper(questionGroup)
}

export async function streamVerdictAction(questionGroup: QuizData, answer: string) {
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.pouncepen.verdict)) {
        throw new Error('You have reached your commentary quota limit.')
    }
    return compareAnswers(questionGroup, answer)
}