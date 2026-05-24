import { generateObject } from 'ai'
import { Lang } from '@repo/env/config'
import { miniAI } from './config'
import { ReviewTranslationFeedbackSchema, type ReviewTranslationFeedback } from '@/lib/review'
import { getReviewLanguageCopy } from '@/lib/review-language'

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

<criteria>
- ALWAYS accept natural variants when they preserve the meaning of the Chinese prompt and use the keyword appropriately. NEVER penalize for minor differences if the usage is standard and natural. 
- Be EXTREMELY FLEXIBLE with expressions, in particular word choices, tones and tenses, as long as they are reasonable (regardless of the reference translation answer).
- Look for mistranslations, missing meaning, incorrect grammar, unnatural keyword usage, or omitting the keyword when it should appear.
</criteria>

<annotation_guidelines>
- badPairs must ALWAYS point to the exact substrings from the student's answer (narrow down to the most precise chunk possible instead of including a large portion).
- improved should contain a corrected version plus a brief Chinese explanation (use symbols like \`→\`; be concrete with the "why" and "how", not just the "where").
- rationale should be one short Chinese sentence about the overall quality.
</annotation_guidelines>

<output_format>
Return a JSON object: {
  "rationale": string,
  "badPairs": [{"original": string, "improved": string}]
}
</output_format>
</prompt>`,
        schema: ReviewTranslationFeedbackSchema,
    })

    return object
}
