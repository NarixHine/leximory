'use server'

import { compareAnswers, pilotPaper } from '@/server/ai/fix'
import { QuizData } from '../../generators/types'

export async function streamAnsweraAction(questionGroup: QuizData) {
    return pilotPaper(questionGroup)
}

export async function streamVerdictAction(questionGroup: QuizData, answer: string) {
    return compareAnswers(questionGroup, answer)
}