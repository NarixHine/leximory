'use server'

import { z } from '@repo/schema'
import { actionClient } from '@repo/service'
import { submitPaperAction } from '@repo/service/paper'
import { getPaper } from '@repo/supabase/paper'
import { computeTotalScore, getPerfectScore } from '@repo/ui/paper/utils'

export const submitAnswersAction = actionClient
    .inputSchema(z.object({
        answers: z.record(z.string(), z.string().nullable()),
        id: z.number()
    }))
    .action(async ({ parsedInput: { answers, id } }) => {
        const { content } = await getPaper({ id })
        await submitPaperAction({
            paperId: id,
            score: computeTotalScore(content, answers),
            perfectScore: getPerfectScore(content),
            answers: answers
        })
    })
