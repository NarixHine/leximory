import 'server-only'

import { z } from '@repo/schema'
import { QuizDataSchema } from '@repo/schema/paper'
import { generateQuestionNote } from '../../ai'
import { saveQuestionNote, loadQuestionNotes, deleteQuestionNote, loadAllNotes, deleteNote } from '@repo/supabase/question-note'
import incrCommentaryQuota from '@repo/user/quota'
import { ACTION_QUOTA_COST } from '@repo/env/config'
import { router, authedProcedure } from '../init'

export const questionNoteRouter = router({
  /**
   * Generates and saves a question note using AI.
   * This action uses AI to generate a structured note entry from the question data,
   * then saves it to the notes table with type "question".
   */
  save: authedProcedure
    .input(z.object({
      quizData: QuizDataSchema,
      questionNo: z.number(),
      userAnswer: z.string(),
      correctAnswer: z.string(),
      isCorrect: z.boolean(),
      paperId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Use AI quota for generating the note
      if (await incrCommentaryQuota(ACTION_QUOTA_COST.quiz.genNote, ctx.user.userId)) {
        throw new Error('Quota exceeded')
      }

      // Generate the question note using AI
      const noteData = await generateQuestionNote({
        quizData: input.quizData,
        questionNo: input.questionNo,
        userAnswer: input.userAnswer,
        correctAnswer: input.correctAnswer,
        isCorrect: input.isCorrect,
      })

      // Save to database with creator
      const result = await saveQuestionNote({
        sentence: noteData.sentence,
        correctAnswer: noteData.correctAnswer,
        wrongAnswer: noteData.wrongAnswer,
        keyPoints: noteData.keyPoints,
        relatedPaper: input.paperId,
        creator: ctx.user.userId,
      })

      return result.id
    }),

  /**
   * Retrieves recent question notes saved by the user.
   */
  getRecent: authedProcedure
    .input(z.object({
      cursor: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      return await loadQuestionNotes({ cursor: input.cursor, creator: ctx.user.userId })
    }),

  /**
   * Deletes a question note by ID.
   */
  delete: authedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await deleteQuestionNote({ id: input.id, creator: ctx.user.userId })
    }),

  /**
   * Retrieves all recent notes (both question and chunk) saved by the user.
   */
  getAll: authedProcedure
    .input(z.object({
      cursor: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      return await loadAllNotes({ cursor: input.cursor, creator: ctx.user.userId })
    }),

  /**
   * Deletes any note by ID.
   */
  deleteAny: authedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await deleteNote({ id: input.id, creator: ctx.user.userId })
    }),
})
