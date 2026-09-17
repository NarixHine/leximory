import 'server-only'
import {
    experimental_evaluate as evaluate,
    type Experimental_EvaluationQuestion,
    type Experimental_EvaluationResult,
} from 'ai'

export const EVALUATION_MODEL = 'typesafe-ai/jev'

export const EVALUATION_STATE_CONTENT_LIMIT = 12000

export type EvaluationState = Parameters<typeof evaluate>[0]['state']

export type EvaluationAnswers<
    QUESTIONS extends Record<string, Experimental_EvaluationQuestion>,
> = Experimental_EvaluationResult<QUESTIONS>['answers']

export async function runEvaluation<
    const QUESTIONS extends Record<string, Experimental_EvaluationQuestion>,
>({
    state,
    questions,
}: {
    state: EvaluationState
    questions: QUESTIONS
}): Promise<{ answers: EvaluationAnswers<QUESTIONS> }> {
    const { answers } = await evaluate({ model: EVALUATION_MODEL, state, questions })
    return { answers }
}
