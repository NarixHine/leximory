import 'server-only'
import { ModelMessage, streamText } from 'ai'
import { buildFeedbackPrompt, buildTestTakerPrompt } from './prompts/fix'
import { QuizData } from '@repo/schema/paper'
import { SMART_AI } from './config'

async function buildMessages(params: {
    questionGroup: QuizData,
} | {
    questionGroup: QuizData,
    preliminaryAnswers: string
}) {
    const { questionGroup } = params
    const { preliminaryAnswers } = 'preliminaryAnswers' in params ? params : { preliminaryAnswers: null }
    const messages: ModelMessage[] = [{
        role: 'user',
        content: buildTestTakerPrompt({
            questionGroup,
        })
    }]

    if (preliminaryAnswers) {
        messages.push({
            role: 'assistant',
            content: `我的答案：${preliminaryAnswers}`
        }, {
            role: 'user',
            content: buildFeedbackPrompt({ questionGroup })
        })
    }

    return messages
}

export async function pilotPaper(questionGroup: QuizData) {
    const messages = await buildMessages({ questionGroup })
    const { textStream } = streamText({
        messages,
        maxOutputTokens: 20000,
        ...SMART_AI
    })

    return textStream
}

export async function compareAnswers(questionGroup: QuizData, preliminaryAnswers: string) {
    const messages = await buildMessages({ questionGroup, preliminaryAnswers })
    const { textStream } = streamText({
        messages,
        maxOutputTokens: 20000,
        ...SMART_AI
    })

    return textStream
}
