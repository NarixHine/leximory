'use server'

import { z } from '@repo/schema'
import { actionClient } from '@repo/service'
import { submitPaperAction } from '@repo/service/paper'
import { getPaper } from '@repo/supabase/paper'
import { computeTotalScore, computePerfectScore } from '@repo/ui/paper/utils'
import { SectionAnswersSchema } from '@repo/schema/paper'

export const submitAnswersAction = actionClient
    .inputSchema(z.object({
        answers: SectionAnswersSchema,
        id: z.number()
    }))
    .action(async ({ parsedInput: { answers, id } }) => {
        const { content } = await getPaper({ id })
        await submitPaperAction({
            paperId: id,
            score: computeTotalScore(content, answers),
            perfectScore: computePerfectScore(content),
            answers
        })
    })
