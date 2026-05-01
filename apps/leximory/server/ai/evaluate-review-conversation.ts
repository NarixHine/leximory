import { generateObject } from 'ai'
import { Lang } from '@repo/env/config'
import { z } from '@repo/schema'
import { miniAI } from './configs'
import { getReviewLanguageCopy } from '@/lib/review-language'
import { LEXIMORY_WORLD_VIEW, type ReviewConversationFeedback } from '@/lib/review'

const ReviewConversationEvaluationSchema = z.object({
    rationale: z.string(),
    goodPairs: z.array(z.object({
        original: z.string(),
        note: z.string(),
    })),
    badPairs: z.array(z.object({
        original: z.string(),
        improved: z.string(),
    })),
    reply: z.string(),
})

export async function evaluateReviewConversation({
    prompt,
    submission,
    keywords,
    lang,
}: {
    prompt: string
    submission: string
    keywords: string[]
    lang: Lang
}): Promise<ReviewConversationFeedback & { reply: string }> {
    const reviewCopy = getReviewLanguageCopy(lang)

    const { object } = await generateObject({
        ...miniAI,
        schema: ReviewConversationEvaluationSchema,
        prompt: `<prompt>
<world>${LEXIMORY_WORLD_VIEW}</world>
<role>
You are evaluating a learner's short reply to the black cat in Leximory.
</role>

<task>
Target language: ${reviewCopy.targetLanguageName}
Black cat's prompt: ${prompt}
Suggested keywords: ${keywords.join(', ')}
Learner's reply: ${submission}
</task>

<evaluation_rules>
- Keep the critique concise and specific.
- goodPairs should point to exact substrings from the learner's reply that are vivid, apt, or gracefully used.
- badPairs should point to exact substrings from the learner's reply that need improvement.
- improved should contain a corrected version plus a short Chinese explanation.
- note should contain a short Chinese praise note.
- rationale should be one short Chinese sentence summarizing the writing.
- reply must NOT sound like an evaluator. It must sound like the black cat herself, in the target language, gently pleased to have learned these things.
- reply should be brief, mild, and warm.
</evaluation_rules>
</prompt>`,
    })

    return object
}
