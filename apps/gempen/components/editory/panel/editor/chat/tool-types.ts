import { z } from 'zod'
import { QuizData } from '@/components/editory/generators/types'
import { GeneratableDataSchema } from '@/server/ai/prompts/sections'
import { GeneratableTypeSchema } from '@/components/editory/generators/config'

export const toolDescriptions = {
    getCurrentItems: 'Reading Paper',
    addQuizItem: 'Adding Section',
    removeQuizItem: 'Removing Section',
    updateQuizItem: 'Updating Questions',
    designQuestions: 'Devising Questions',
} as const

export type ToolResult = {
    getCurrentItems: QuizData[]
    addQuizItem: undefined
    removeQuizItem: undefined
    updateQuizItem: undefined
    designQuestions: z.infer<typeof GeneratableDataSchema>
}

export const toolSchemas = {
    getCurrentItems: z.object({}),
    addQuizItem: GeneratableDataSchema,
    removeQuizItem: z.object({
        id: z.string(),
    }),
    updateQuizItem: z.object({
        id: z.string(),
        data: GeneratableDataSchema,
    }),
    designQuestionsInput: z.object({
        adaptedText: z.string().min(1),
        type: GeneratableTypeSchema,
    }),
    designQuestionsOutput: GeneratableDataSchema,
} as const

export type ToolName = keyof ToolResult
