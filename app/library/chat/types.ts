import { z } from 'zod'
import { getAllTextsInLib, getLib, listLibsWithFullInfo } from '@/server/db/lib'
import { getAllWordsInLib, getForgetCurve } from '@/server/db/word'
import { getTextContent } from '@/server/db/text'
import { getTexts } from '@/server/db/text'
import { Lang, langMap } from '@/lib/config'

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
}

export const toolSchemas = {
    getLib: z.object({ id: z.string().describe('The id of the library') }),
    getAllWordsInLib: z.object({ lib: z.string().describe('The id of the library') }),
    getTexts: z.object({ lib: z.string().describe('The id of the library') }),
    getTextContent: z.object({ id: z.string().describe('The id of the text') }),
    getWord: z.object({ id: z.string().describe('The id of the word') }),
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
    })
} as const

export type ToolName = keyof ToolResult 
