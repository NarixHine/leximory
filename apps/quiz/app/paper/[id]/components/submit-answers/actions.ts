'use server'

import { z } from '@repo/schema'
import { actionClient } from '@repo/service'
import { getPaper } from '@repo/supabase/paper'

export const submitAnswersAction = actionClient
    .inputSchema(z.object({
        answers: z.record(z.string(), z.string().nullable()),
        id: z.number()
    }))
    .action(async ({ parsedInput: { answers, id } }) => {
        await getPaper({ id })
    })
