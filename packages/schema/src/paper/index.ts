import { z } from '@repo/schema'
import { JSX } from 'react'

/**
 * The types of sections supported in Ask.
 */
export const AskResponseSchema = z.object({
    explanation: z.string(),
    highlights: z.array(z.string()).optional(),
})
export type AskResponse = z.infer<typeof AskResponseSchema>

/**
 * Defines the props that are passed to a strategy's render functions.
 * It includes all the necessary data calculated by the main component.
 */
export interface StrategyRenderProps<T extends QuizData = QuizData, O = unknown> {
    data: T
    config: Config
    answers: { [key: number]: string | null }
    options: O
    correctAnswers: string[]
    isCorrect: (userAnswer: string, correctAnswer: string) => boolean
}

/**
 * Defines the structure of a question strategy object.
 * Each strategy provides the unique logic for a specific question type.
 */
export interface QuestionStrategy<T extends QuizData = QuizData, O = unknown> {
    getQuestionCount: (data: T) => number
    getOptions?: (data: T) => O
    getCorrectAnswers: (data: T, options: O) => string[]
    getLlmReadyText?: (data: T) => { paper: string, key: string }
    isCorrect: (userAnswer: string, correctAnswer: string) => boolean
    generateKey: (props: StrategyRenderProps<T, O>) => Record<number, string>
    renderPaper: (props: StrategyRenderProps<T, O>) => JSX.Element | null
    renderAnswerSheet?: (props: StrategyRenderProps<T, O>) => JSX.Element | null
    renderKey: (props: StrategyRenderProps<T, O>) => JSX.Element | null
    renderRubric: () => JSX.Element | null
    keyPerLine: number
    getDefaultValue: () => T
    scorePerQuestion: number
}

const BaseQuizSchema = z.object({
    id: z.string()
})

export const FishingDataSchema = BaseQuizSchema.extend({
    text: z.string(),
    type: z.literal('fishing'),
    distractors: z.array(z.string())
})
export type FishingData = z.infer<typeof FishingDataSchema>

export const ClozeDataSchema = BaseQuizSchema.extend({
    text: z.string(),
    type: z.literal('cloze'),
    questions: z.array(z.object({
        original: z.string(),
        distractors: z.array(z.string())
    }))
})
export type ClozeData = z.infer<typeof ClozeDataSchema>

export const GrammarDataSchema = BaseQuizSchema.extend({
    text: z.string(),
    type: z.literal('grammar'),
    hints: z.record(z.string(), z.string().optional())
})
export type GrammarData = z.infer<typeof GrammarDataSchema>

export const SentenceChoiceDataSchema = BaseQuizSchema.extend({
    text: z.string(),
    type: z.literal('sentences'),
    distractors: z.array(z.string())
})
export type SentenceChoiceData = z.infer<typeof SentenceChoiceDataSchema>

const QuestionSchema = z.object({
    q: z.string(),
    a: z.array(z.string()),
    correct: z.number() // index of the correct answer
})
export type Question = z.infer<typeof QuestionSchema>

export const ReadingDataSchema = BaseQuizSchema.extend({
    text: z.string(),
    type: z.literal('reading'),
    questions: z.array(QuestionSchema)
})
export type ReadingData = z.infer<typeof ReadingDataSchema>

const ListeningQuestionSchema = QuestionSchema.extend({
    transcript: z.string()
})
export type ListeningQuestion = z.infer<typeof ListeningQuestionSchema>

export const ListeningDataSchema = BaseQuizSchema.extend({
    type: z.literal('listening'),
    questions: z.array(ListeningQuestionSchema)
})
export type ListeningData = z.infer<typeof ListeningDataSchema>

export const CustomDataSchema = BaseQuizSchema.extend({
    type: z.literal('custom'),
    paper: z.string(),
    key: z.string()
})
export type CustomData = z.infer<typeof CustomDataSchema>

const DataSchemas = [
    FishingDataSchema,
    ClozeDataSchema,
    GrammarDataSchema,
    SentenceChoiceDataSchema,
    ReadingDataSchema,
    ListeningDataSchema,
    CustomDataSchema
] as const
export const QuizDataSchema = z.discriminatedUnion('type', DataSchemas)
export type QuizData = z.infer<typeof QuizDataSchema>
export type QuizDataType = QuizData['type']
export const QuizItemsSchema = z.array(QuizDataSchema)
export type QuizItems = z.infer<typeof QuizItemsSchema>

export type Config = {
    /** @default 1 */
    start?: number,
    countSpaces?: number,
}
