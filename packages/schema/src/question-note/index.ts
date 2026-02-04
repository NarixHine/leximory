import { z } from '@repo/schema'

/**
 * Schema for the AI-generated question note response.
 * Contains structured information about the question for review.
 */
export const QuestionNoteResponseSchema = z.object({
    /** The sentence in question with context (using ▁▁▁▁▁ for the blank) */
    sentence: z.string(),
    /** The correct answer */
    correctAnswer: z.string(),
    /** The user's wrong answer (only present if user answered incorrectly) */
    wrongAnswer: z.string().optional(),
    /** Key point(s) to remember about this question */
    keyPoints: z.string(),
})

export type QuestionNoteResponse = z.infer<typeof QuestionNoteResponseSchema>

/**
 * Schema for a saved question note entry.
 */
export const QuestionNoteSchema = z.object({
    id: z.string(),
    word: z.string(),
    date: z.string(),
})

export type QuestionNote = z.infer<typeof QuestionNoteSchema>
