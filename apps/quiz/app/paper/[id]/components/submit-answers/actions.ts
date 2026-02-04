'use server'

import { z } from '@repo/schema'
import { actionClient } from '@repo/service'
import { submitPaperAction } from '@repo/service/paper'
import { getPaper } from '@repo/supabase/paper'
import { computeTotalScore, computePerfectScore } from '@repo/ui/paper/utils'
import { SectionAnswersSchema, SectionAnswers } from '@repo/schema/paper'

/**
 * Sanitizes section-based answers by trimming whitespace from all answer strings.
 * Empty strings are normalized to null (treated as unanswered).
 */
function sanitizeAnswers(answers: SectionAnswers): SectionAnswers {
    const sanitized: SectionAnswers = {}
    for (const sectionId in answers) {
        sanitized[sectionId] = {}
        const sectionAnswers = answers[sectionId]
        for (const localNoStr in sectionAnswers) {
            const localNo = Number(localNoStr)
            const answer = sectionAnswers[localNo]
            const trimmed = answer?.trim()
            sanitized[sectionId][localNo] = trimmed === '' ? null : trimmed ?? null
        }
    }
    return sanitized
}

export const submitAnswersAction = actionClient
    .inputSchema(z.object({
        answers: SectionAnswersSchema,
        id: z.number()
    }))
    .action(async ({ parsedInput: { answers, id } }) => {
        const { content } = await getPaper({ id })
        const sanitizedAnswers = sanitizeAnswers(answers)
        await submitPaperAction({
            paperId: id,
            score: computeTotalScore(content, sanitizedAnswers),
            perfectScore: computePerfectScore(content),
            answers: sanitizedAnswers
        })
    })
