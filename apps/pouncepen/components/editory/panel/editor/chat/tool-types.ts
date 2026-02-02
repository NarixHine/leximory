import { GeneratableDataSchema } from '@/server/ai/prompts/sections'
import { z } from '@repo/schema'
import { QuizData } from '@repo/schema/paper'   
import { extractArticleFromUrl } from '@repo/scrape'
import { GeneratableTypeSchema } from '@repo/ui/paper/utils'

export const toolDescriptions = {
    getCurrentItems: {
        loading: 'Reading Paper',
        completed: 'Paper Retrieved'
    },
    addQuizItem: {
        loading: 'Adding Section',
        completed: 'Section Added'
    },
    removeQuizItem: {
        loading: 'Removing Section',
        completed: 'Section Removed'
    },
    updateQuizItem: {
        loading: 'Updating Questions',
        completed: 'Questions Updated'
    },
    designQuestions: {
        loading: 'Devising Questions',
        completed: 'Questions Devised'
    },
    scrapeArticle: {
        loading: 'Scraping Webpage',
        completed: 'Article Extracted'
    }
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
        specialInstructions: z.string().optional(),
    }),
    designQuestionsOutput: GeneratableDataSchema,
    scrapeArticle: z.object({
        url: z.url().describe('The URL of the webpage to extract the article from'),
    }),
} as const

export type ToolName = keyof ToolResult
