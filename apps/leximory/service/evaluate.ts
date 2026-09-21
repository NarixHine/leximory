import 'server-only'
import type { Experimental_EvaluationQuestion } from 'ai'
import { ACTION_QUOTA_COST } from '@repo/env/config'
import incrCommentaryQuota, { maxCommentaryQuota } from '@repo/user/quota'
import { runEvaluation, type EvaluationAnswers, type EvaluationState } from '@/server/ai/evaluate'

export async function evaluateWithQuota<
    const QUESTIONS extends Record<string, Experimental_EvaluationQuestion>,
>({
    state,
    questions,
    userId,
    delayRevalidate = false,
}: {
    state: EvaluationState
    questions: QUESTIONS
    userId?: string
    delayRevalidate?: boolean
}): Promise<{ answers: EvaluationAnswers<QUESTIONS> } | { error: string }> {
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.evaluation, userId, delayRevalidate)) {
        return { error: `本月 ${await maxCommentaryQuota(userId)} 词点额度耗尽。` }
    }

    try {
        return await runEvaluation({ state, questions })
    } catch (error) {
        console.error('[evaluate] evaluation failed', error)
        return { error: '评估失败，请稍后重试。' }
    }
}
