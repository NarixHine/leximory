'use server'

import { actionClient } from '../safe-action-client'
import { z } from '@repo/schema'
import { QuizDataSchema } from '@repo/schema/paper'
import { getUserOrThrow } from '@repo/user'
import { generateQuestionNote } from '../ai'
import { saveQuestionNote, loadQuestionNotes, deleteQuestionNote } from '@repo/supabase/question-note'
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
        
        // Save to database with creator
        const result = await saveQuestionNote({
            sentence: noteData.sentence,
            correctAnswer: noteData.correctAnswer,
            wrongAnswer: noteData.wrongAnswer,
            keyPoints: noteData.keyPoints,
            relatedPaper: paperId,
            creator: userId,
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
        const { userId } = await getUserOrThrow()
        return await loadQuestionNotes({ cursor, creator: userId })
    })

/**
 * Deletes a question note by ID.
 */
export const deleteQuestionNoteAction = actionClient
    .inputSchema(z.object({
        id: z.number(),
    }))
    .action(async ({ parsedInput: { id } }) => {
        const { userId } = await getUserOrThrow()
        return await deleteQuestionNote({ id, creator: userId })
    })
