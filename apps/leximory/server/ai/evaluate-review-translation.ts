import { generateObject } from 'ai'
import { Lang } from '@repo/env/config'
import { z } from '@repo/schema'
import { TranslationFeedbackSchema } from '@repo/schema/paper'
import { miniAI } from './configs'
import type { ReviewTranslationFeedback } from '@/lib/review'
import { getReviewLanguageCopy } from '@/lib/review-language'

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
    prompt,
    answer,
    keyword,
    submission,
    lang,
}: {
    prompt: string
    answer: string
    keyword: string
    submission: string
    lang: Lang
}): Promise<ReviewTranslationFeedback> {
    const reviewCopy = getReviewLanguageCopy(lang)

    const { object } = await generateObject({
        ...miniAI,
        prompt: `<prompt>
<role>You are a strict, objective marker for a ${reviewCopy.targetLanguageName} translation exercise.</role>

<task>
Mark the student's ${reviewCopy.targetLanguageName} translation.

${reviewCopy.promptLabel}: ${prompt}
Required keyword: ${keyword}
Reference ${reviewCopy.targetLanguageName} translation: ${answer}
Student's ${reviewCopy.targetLanguageName} translation: ${submission}
</task>

<marking_criteria>
- Start at the full score of 5 and subtract for each issue found.
- Accept natural variants when they preserve the meaning of the Chinese prompt and use the keyword appropriately.
- Deduct for mistranslations, missing meaning, incorrect grammar, unnatural keyword usage, or omitting the keyword when it should appear.
- Score cannot go below 0.
</marking_criteria>

<annotation_guidelines>
- badPairs must point to exact substrings from the student's answer.
- improved should contain a corrected version plus a brief Chinese explanation.
- rationale should be one short Chinese sentence about the overall quality.
- The number of badPairs should match the number of deductions whenever possible.
</annotation_guidelines>

<output_format>
Return a JSON object: {
  "items": [{"score": number, "maxScore": number, "rationale": string, "badPairs": [{"original": string, "improved": string}]}],
  "totalScore": number
}
</output_format>
</prompt>`,
        schema: ReviewTranslationEvaluationSchema,
    })

    return {
        rationale: object.items[0]?.rationale ?? '',
        badPairs: object.items[0]?.badPairs ?? [],
    }
}
