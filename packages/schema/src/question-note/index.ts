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
 * The content structure for a question note (stored as JSON string in DB).
 */
export interface QuestionNoteContent {
    sentence: string
    correctAnswer: string
    wrongAnswer?: string
    keyPoints: string
}

/**
 * Serializes the question note content to JSON string.
 */
export function serializeQuestionNoteContent(content: QuestionNoteContent): string {
    return JSON.stringify(content)
}

/**
 * Parses a question note content from JSON string.
 */
export function parseQuestionNoteContent(content: string): QuestionNoteContent | null {
    try {
        const parsed = JSON.parse(content)
        if (typeof parsed.sentence === 'string' && typeof parsed.correctAnswer === 'string' && typeof parsed.keyPoints === 'string') {
            return parsed as QuestionNoteContent
        }
        return null
    } catch {
        return null
    }
}

/**
 * Schema for a saved question note entry.
 */
export const QuestionNoteSchema = z.object({
    id: z.number(),
    content: z.string(),
    date: z.string(),
    relatedPaper: z.number().nullable(),
})

export type QuestionNote = z.infer<typeof QuestionNoteSchema>
