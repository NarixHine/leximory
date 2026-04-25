import { generateObject } from 'ai'
import { z } from '@repo/schema'
import { TranslationFeedbackSchema, type TranslationData } from '@repo/schema/paper'
import { buildTranslationMarkingPrompt } from '@repo/service/ai/prompts/subjective'
import { miniAI } from './configs'
import type { ReviewTranslationFeedback } from '@/lib/review'

const ReviewTranslationEvaluationSchema = TranslationFeedbackSchema.omit({ type: true }).extend({
    items: z.array(z.object({
        score: z.number(),
        maxScore: z.number(),
        rationale: z.string(),
        badPairs: z.array(z.object({
            original: z.string(),
            improved: z.string(),
        })),
    })).length(1),
})

export async function evaluateReviewTranslation({
    chinese,
    answer,
    keyword,
    submission,
}: {
    chinese: string
    answer: string
    keyword: string
    submission: string
}): Promise<ReviewTranslationFeedback> {
    const data: TranslationData = {
        id: 'review-translation',
        type: 'translation',
        items: [{
            chinese,
            keyword,
            references: [answer],
            score: 5,
        }],
    }

    const { object } = await generateObject({
        ...miniAI,
        prompt: buildTranslationMarkingPrompt(data, { 1: submission }),
        schema: ReviewTranslationEvaluationSchema,
    })

    return {
        rationale: object.items[0]?.rationale ?? '',
        badPairs: object.items[0]?.badPairs ?? [],
    }
}
