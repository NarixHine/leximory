import 'server-only'
import { streamObject } from 'ai'
import { FLASH_AI } from './config'
import { SectionType } from './prompts/sections'
import { buildAskPrompt, buildAskSystemPrompt } from './prompts/ask'
import { QuizData } from '@/components/editory/generators/types'
import { AskResponseSchema } from './types'

export type StreamExplanationParams = {
    quizData: QuizData,
    questionNo: number,
    userAnswer: string
}

export async function streamExplanation({ quizData, questionNo, userAnswer }: StreamExplanationParams) {
    const { partialObjectStream, object } = streamObject({
        prompt: buildAskPrompt(quizData, questionNo, userAnswer),
        system: buildAskSystemPrompt(quizData.type as SectionType),
        maxOutputTokens: 10000,
        ...FLASH_AI,
        schema: AskResponseSchema
    })
    return { partialObjectStream, object }
}
