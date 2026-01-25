import { z } from '@repo/schema'
import { getAllTextsInLib, getLib, listLibsWithFullInfo } from '@/server/db/lib'
import { getAllWordsInLib, getWordsWithin } from '@/server/db/word'
import { getTextContent } from '@/server/db/text'
import { getTexts } from '@/server/db/text'
import { Lang, SUPPORTED_LANGS } from '@repo/env/config'
import { annotateParagraph } from '@/server/ai/annotate'
import { extractArticleFromUrl } from '@repo/scrape'

export const toolDescriptions = {
    listLibs: 'Fetching available libraries ...',
    getLib: 'Loading library details ...',
    getAllWordsInLib: 'Retrieving words from library ...',
    getTexts: 'Loading library texts ...',
    getTextContent: 'Fetching text content ...',
    getAllTextsInLib: 'Retrieving library texts ...',
    annotateArticle: 'Creating annotated article ...',
    getForgetCurve: 'Looking for words to review ...',
    annotateParagraph: 'Adding annotations ...',
    extractArticleFromWebpage: 'Extracting article from webpage ...',
    requestPublishStreakMemory: 'Drafting streak memory ...'
} as const

export type ToolResult = {
    listLibs: ReturnType<typeof listLibsWithFullInfo>
    getLib: ReturnType<typeof getLib>
    getAllWordsInLib: ReturnType<typeof getAllWordsInLib>
    getTexts: ReturnType<typeof getTexts>
    getTextContent: ReturnType<typeof getTextContent>
    getAllTextsInLib: ReturnType<typeof getAllTextsInLib>
    getForgetCurve: ReturnType<typeof getWordsWithin>
    annotateArticle: {
        id: string
        title: string
        createdAt: string
        libId: string
    }
    annotateParagraph: {
        annotation: Awaited<ReturnType<typeof annotateParagraph>>
        lang: Lang
    }
    extractArticleFromWebpage: Awaited<ReturnType<typeof extractArticleFromUrl>>
    requestPublishStreakMemory: {
        content: string
        user: {
            id: string
            username: string | undefined
            avatar_url: string | undefined
        }
    }
}

export const toolSchemas = {
    getLib: z.object({ id: z.string().describe('The id of the library') }),
    getAllWordsInLib: z.object({ lib: z.string().describe('The id of the library') }),
    getTexts: z.object({ lib: z.string().describe('The id of the library') }),
    getTextContent: z.object({ id: z.string().describe('The id of the text') }),
    getAllTextsInLib: z.object({ libId: z.string().describe('The id of the library') }),
    listLibs: z.object({}),
    annotateArticle: z.object({
        lib: z.string().describe('The id of the library'),
        title: z.string().describe('The title of the text (entitle it if not given)'),
        content: z.string().describe('The content of the text')
    }),
    getForgetCurve: z.object({ period: z.enum(['day', 'week']).describe('The time period to get words for. You can only choose from: day, week'), }),
    annotateParagraph: z.object({
        content: z.string().describe('The content of the paragraph to annotate'),
        lang: z.enum(SUPPORTED_LANGS).describe('The language of the paragraph')
    }),
    extractArticleFromWebpage: z.object({
        url: z.string().describe('The URL of the webpage to extract the article from')
    }),
    requestPublishStreakMemory: z.object({
        content: z.string().describe("The user's summary of what they learned today.")
    })
} as const

export type ToolName = keyof ToolResult
