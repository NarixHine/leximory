import { z } from 'zod'
import { QuizData } from '@/components/editory/generators/types'
import { GeneratableDataSchema } from '@/server/ai/prompts/sections'
import { GeneratableTypeSchema } from '@/components/editory/generators/config'
import { extractArticleFromUrl } from '@repo/scrape'

export const toolDescriptions = {
    getCurrentItems: 'Reading Paper',
    addQuizItem: 'Adding Section',
    removeQuizItem: 'Removing Section',
    updateQuizItem: 'Updating Questions',
    designQuestions: 'Devising Questions',
    scrapeArticle: 'Extracting Article from Webpage'
} as const

export type ToolResult = {
    getCurrentItems: QuizData[]
    addQuizItem: undefined
    removeQuizItem: undefined
    updateQuizItem: undefined
    designQuestions: z.infer<typeof GeneratableDataSchema>
    scrapeArticle: Awaited<ReturnType<typeof extractArticleFromUrl>>
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
    scrapeArticle: z.object({
        url: z.url().describe('The URL of the webpage to extract the article from'),
    }),
} as const

export type ToolName = keyof ToolResult
