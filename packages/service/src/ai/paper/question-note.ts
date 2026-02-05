import 'server-only'
import { generateObject } from 'ai'
import { FLASH_AI } from '../config'
import { QuestionNoteResponseSchema } from '@repo/schema/question-note'
import { buildQuestionNotePrompt, buildQuestionNoteSystemPrompt } from '../prompts/question-note'
import { SectionType } from '../prompts/sections'
import { QuizData } from '@repo/schema/paper'

export interface GenerateQuestionNoteParams {
    quizData: QuizData
    questionNo: number
    userAnswer: string
    correctAnswer: string
    isCorrect: boolean
}

export async function generateQuestionNote({ quizData, questionNo, userAnswer, correctAnswer, isCorrect }: GenerateQuestionNoteParams) {
    const { object } = await generateObject({
        prompt: buildQuestionNotePrompt(quizData, questionNo, userAnswer, correctAnswer, isCorrect),
        system: buildQuestionNoteSystemPrompt(quizData.type as SectionType),
        maxOutputTokens: 2000,
        ...FLASH_AI,
        schema: QuestionNoteResponseSchema,
    })
    return object
}
