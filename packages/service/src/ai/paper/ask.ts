import 'server-only'
import { streamObject } from 'ai'
import { FLASH_AI } from '../config'
import { QuizData, StreamExplanationParams } from '@repo/schema/paper'
import { buildAskPrompt, buildAskSystemPrompt } from '../prompts/ask'
import { SectionType } from '../prompts/sections'
import { AskResponseSchema } from '@repo/schema/paper'
import { setAskCache } from '@repo/kv'
import { hashAskParams } from '@repo/utils/paper'

export async function streamExplanation({ quizData, questionNo, userAnswer }: StreamExplanationParams) {
    const { partialObjectStream, object } = streamObject({
        prompt: buildAskPrompt(quizData, questionNo, userAnswer),
        system: buildAskSystemPrompt(quizData.type as SectionType),
        maxOutputTokens: 10000,
        ...FLASH_AI,
        schema: AskResponseSchema,
        onFinish: async (result) => {
            await setAskCache({
                hash: hashAskParams({ quizData, questionNo, userAnswer }),
                cache: JSON.stringify(result.object)
            })
        }
    })
    return { partialObjectStream, object }
}
