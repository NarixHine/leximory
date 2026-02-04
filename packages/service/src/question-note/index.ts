'use server'

import { actionClient } from '../safe-action-client'
import { z } from '@repo/schema'
import { QuizDataSchema } from '@repo/schema/paper'
import { getUserOrThrow } from '@repo/user'
import { generateQuestionNote } from '../ai'
import { saveQuestionNote, loadQuestionNotes } from '@repo/supabase/question-note'
import { Kilpi } from '../kilpi'
import incrCommentaryQuota from '@repo/user/quota'

const saveQuestionNoteSchema = z.object({
    quizData: QuizDataSchema,
    questionNo: z.number(),
    userAnswer: z.string(),
    correctAnswer: z.string(),
    isCorrect: z.boolean(),
    paperId: z.number().optional(),
})

/**
 * Generates and saves a question note using AI.
 * This action uses AI to generate a structured note entry from the question data,
 * then saves it to the notes table with type "question".
 */
export const saveQuestionNoteAction = actionClient
    .inputSchema(saveQuestionNoteSchema)
    .action(async ({ parsedInput: { quizData, questionNo, userAnswer, correctAnswer, isCorrect, paperId } }) => {
        await Kilpi.authed().authorize().assert()
        const { userId } = await getUserOrThrow()
        
        // Use AI quota for generating the note
        if (await incrCommentaryQuota(1, userId)) {
            throw new Error('Quota exceeded')
        }
        
        // Generate the question note using AI
        const noteData = await generateQuestionNote({
            quizData,
            questionNo,
            userAnswer,
            correctAnswer,
            isCorrect,
        })
        
        // Save to database
        const result = await saveQuestionNote({
            sentence: noteData.sentence,
            correctAnswer: noteData.correctAnswer,
            wrongAnswer: noteData.wrongAnswer,
            keyPoints: noteData.keyPoints,
            relatedPaper: paperId,
        })
        
        return result.id
    })

/**
 * Retrieves recent question notes saved by the user.
 */
export const getRecentQuestionNotesAction = actionClient
    .inputSchema(z.object({
        cursor: z.string().optional(),
    }))
    .action(async ({ parsedInput: { cursor } }) => {
        await getUserOrThrow()
        return await loadQuestionNotes({ cursor })
    })
