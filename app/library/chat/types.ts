import { z } from 'zod'
import { getAllTextsInLib, getLib, listLibsWithFullInfo } from '@/server/db/lib'
import { getAllWordsInLib, getWordsWithin } from '@/server/db/word'
import { getTextContent } from '@/server/db/text'
import { getTexts } from '@/server/db/text'
import { Lang, supportedLangs } from '@/lib/config'
import QuizData from '@/components/editory/generators/types'
import { annotateParagraph } from '@/server/ai/annotate'
import { getArticleFromUrl } from '@/lib/utils'
import { AI_GENERATABLE } from '@/components/editory/generators/config'
import { TimesData } from '@/components/times/types'

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
    generateQuiz: 'Generating quiz questions ...',
    extractArticleFromWebpage: 'Extracting article from webpage ...',
    getTodaysTimes: 'Loading today\'s Times issue ...',
    getTimesIssue: 'Fetching Times issue ...'
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
    extractArticleFromWebpage: Awaited<ReturnType<typeof getArticleFromUrl>>
    generateQuiz: QuizData
    getTodaysTimes: TimesData
    getTimesIssue: TimesData
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
        lang: z.enum(supportedLangs).describe('The language of the paragraph')
    }),
    generateQuiz: z.object({
        content: z.string().describe('The text content to generate quiz from'),
        type: z.enum(AI_GENERATABLE).describe('The type of quiz to generate. Choose from: fishing (vocabulary, 十一选十/小猫钓鱼), cloze (fill in the blanks), 4/6 (sentence choice), reading (reading comprehension)')
    }),
    extractArticleFromWebpage: z.object({
        url: z.string().describe('The URL of the webpage to extract the article from')
    }),
    getTodaysTimes: z.object({}),
    getTimesIssue: z.object({
        date: z.string().describe('The date of the Times issue in YYYY-MM-DD format')
    })
} as const

export type ToolName = keyof ToolResult
