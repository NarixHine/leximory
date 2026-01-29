'use server'

import { compareAnswers, pilotPaper } from '@/server/ai/fix'
import { incrCommentaryQuota } from '@repo/user/quota'
import { ACTION_QUOTA_COST } from '@repo/env/config'
import { QuizData } from '@repo/schema/paper'

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