import { z } from 'zod'
import { getAllTextsInLib, getLib, listLibsWithFullInfo } from '@/server/db/lib'
import { getAllWordsInLib, getForgetCurve } from '@/server/db/word'
import { getTextContent } from '@/server/db/text'
import { getTexts } from '@/server/db/text'

export type ToolResult = {
    listLibs: ReturnType<typeof listLibsWithFullInfo>
    getLib: ReturnType<typeof getLib>
    getAllWordsInLib: ReturnType<typeof getAllWordsInLib>
    getTexts: ReturnType<typeof getTexts>
    getTextContent: ReturnType<typeof getTextContent>
    getAllTextsInLib: ReturnType<typeof getAllTextsInLib>
    getForgetCurve: ReturnType<typeof getForgetCurve>
}

export const toolSchemas = {
    getLib: z.object({ id: z.string().describe('The id of the library') }),
    getAllWordsInLib: z.object({ lib: z.string().describe('The id of the library') }),
    getTexts: z.object({ lib: z.string().describe('The id of the library') }),
    getTextContent: z.object({ id: z.string().describe('The id of the text') }),
    getWord: z.object({ id: z.string().describe('The id of the word') }),
    getAllTextsInLib: z.object({ libId: z.string().describe('The id of the library') }),
    listLibs: z.object({})
} as const

export type ToolName = keyof ToolResult 
