import { z } from 'zod'
import { getAllTextsInLib, getLib, listLibsWithFullInfo } from '@/server/db/lib'
import { getAllWordsInLib, getForgetCurve } from '@/server/db/word'
import { getTextContent } from '@/server/db/text'
import { getTexts } from '@/server/db/text'
import { Lang, langMap } from '@/lib/config'
import QuizData, { AI_GEN_QUIZ_DATA_TYPE_LIST } from '@/lib/editory/types'

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
    generateQuiz: 'Generating quiz questions ...'
} as const

export type ToolResult = {
    listLibs: ReturnType<typeof listLibsWithFullInfo>
    getLib: ReturnType<typeof getLib>
    getAllWordsInLib: ReturnType<typeof getAllWordsInLib>
    getTexts: ReturnType<typeof getTexts>
    getTextContent: ReturnType<typeof getTextContent>
    getAllTextsInLib: ReturnType<typeof getAllTextsInLib>
    getForgetCurve: ReturnType<typeof getForgetCurve>
    annotateArticle: {
        id: string
        title: string
        updatedAt: string
        createdAt: string
        libId: string
    }
    annotateParagraph: string
    generateQuiz: QuizData
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
        lang: z.enum(Object.keys(langMap) as [Lang, ...Lang[]]).describe('The language of the paragraph')
    }),
    generateQuiz: z.object({
        content: z.string().describe('The text content to generate quiz from'),
        type: z.enum(AI_GEN_QUIZ_DATA_TYPE_LIST).describe('The type of quiz to generate. Choose from: fishing (vocabulary, 十一选十/小猫钓鱼), cloze (fill in the blanks), 4/6 (sentence choice), reading (reading comprehension)')
    })
} as const

export type ToolName = keyof ToolResult 
