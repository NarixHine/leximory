'use server'

import { z } from 'zod'
import { actionClient } from '@/lib/safe-actions'
import { QuizItemsSchema } from '../../generators/types'
import { publishAssignment } from '@/server/db/assignments/service'

export const publishAssignmentAction = actionClient
    .inputSchema(
        z.object({
            quiz: QuizItemsSchema,
            title: z.string().min(1, 'Title is required'),
        }),
    )
    .action(async ({ parsedInput: { quiz, title } }) => {
        await publishAssignment({ quiz, title })
        return { success: true }
    })
