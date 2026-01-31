import { createHash } from 'crypto'
import { StreamExplanationParams } from '@repo/schema/paper'

export function hashAskParams({ quizData, questionNo, userAnswer }: StreamExplanationParams) {
    return createHash('sha256').update(`${JSON.stringify(quizData)}${questionNo}${userAnswer}`).digest('hex')
}
