import { z } from '@repo/schema'
import { JSX } from 'react'

export type StreamExplanationParams = {
    quizData: QuizData,
    questionNo: number,
    userAnswer: string
}

/**
 * The schema for section-based answers.
 * Structure: { sectionId: { localQuestionNo: optionText } }
 * - sectionId: The unique ID of the quiz section (e.g., 'abc123')
 * - localQuestionNo: 1-based index within the section (not global question number)
 * - optionText: The actual answer text/word, not the marker (A, B, C, etc.)
 */
export const SectionAnswersSchema = z.record(z.string(), z.record(z.coerce.number(), z.string().nullable()))
export type SectionAnswers = z.infer<typeof SectionAnswersSchema>

/**
 * @deprecated Use SectionAnswersSchema instead. This schema is kept for backwards compatibility.
 * The legacy schema for user-submitted answers using global question numbers.
 */
export const AnswersSchema = z.record(z.number(), z.string().nullable())
export type Answers = z.infer<typeof AnswersSchema>

/**
 * The type of a response from Ask.
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
    answers: SectionAnswers
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
    renderPaper: (props: StrategyRenderProps<T, O>) => JSX.Element | null
    renderAnswerSheet?: (props: StrategyRenderProps<T, O>) => JSX.Element | null
    renderRubric: () => JSX.Element | null
    keyPerLine: number
    getDefaultValue: () => T
    scorePerQuestion: number
    /** Override the default perfect score calculation (questionCount × scorePerQuestion). */
    getPerfectScore?: (data: T) => number
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

/**
 * Schema for a Summary question.
 * The test taker reads `text` and writes a summary (≤61 words).
 * Marking: 5 pts content + 5 pts language = 10 pts total.
 */
export const SummaryDataSchema = BaseQuizSchema.extend({
    type: z.literal('summary'),
    text: z.string(),
    essentialItems: z.array(z.string()),
    extraItems: z.array(z.string()),
    referenceSummary: z.string(),
})
export type SummaryData = z.infer<typeof SummaryDataSchema>

/**
 * Schema for a Translation question.
 * Each item: Chinese sentence + required keyword + reference translation(s).
 * Default scoring: 3, 4, 4, 5 per item (total 16).
 */
export const TranslationItemSchema = z.object({
    chinese: z.string(),
    keyword: z.string(),
    references: z.array(z.string()),
    score: z.number(),
})
export type TranslationItem = z.infer<typeof TranslationItemSchema>

export const TranslationDataSchema = BaseQuizSchema.extend({
    type: z.literal('translation'),
    items: z.array(TranslationItemSchema),
})
export type TranslationData = z.infer<typeof TranslationDataSchema>

/**
 * Schema for a Guided Writing question.
 * `guidance` is the Chinese writing prompt shown to the test taker.
 * Marking: content (0–10) + language (0–10) + structure (0–5) = 25 pts.
 */
export const WritingDataSchema = BaseQuizSchema.extend({
    type: z.literal('writing'),
    guidance: z.string(),
})
export type WritingData = z.infer<typeof WritingDataSchema>

/** Feedback schema for Summary marking results stored in submissions.feedback */
export const SummaryFeedbackSchema = z.object({
    type: z.literal('summary'),
    contentScore: z.number(),
    languageScore: z.number(),
    totalScore: z.number(),
    essentialItemResults: z.array(z.object({ item: z.string(), fulfilled: z.boolean(), note: z.string() })),
    extraItemResults: z.array(z.object({ item: z.string(), fulfilled: z.boolean(), note: z.string() })),
    copiedChunks: z.array(z.string()),
    rationale: z.string(),
})
export type SummaryFeedback = z.infer<typeof SummaryFeedbackSchema>

/** Feedback schema for Translation marking results stored in submissions.feedback */
export const TranslationFeedbackSchema = z.object({
    type: z.literal('translation'),
    items: z.array(z.object({
        score: z.number(),
        maxScore: z.number(),
        rationale: z.string(),
    })),
    totalScore: z.number(),
})
export type TranslationFeedback = z.infer<typeof TranslationFeedbackSchema>

/** Feedback schema for Guided Writing marking results stored in submissions.feedback */
export const WritingFeedbackSchema = z.object({
    type: z.literal('writing'),
    contentScore: z.number(),
    languageScore: z.number(),
    structureScore: z.number(),
    totalScore: z.number(),
    rationale: z.string(),
    corrected: z.string(),
    badPairs: z.array(z.object({ original: z.string(), improved: z.string() })),
    goodPairs: z.array(z.object({ original: z.string(), why: z.string() })),
})
export type WritingFeedback = z.infer<typeof WritingFeedbackSchema>

/** Union of all subjective feedback types, keyed by section ID in the feedback jsonb column */
export const SubjectiveFeedbackSchema = z.discriminatedUnion('type', [
    SummaryFeedbackSchema,
    TranslationFeedbackSchema,
    WritingFeedbackSchema,
])
export type SubjectiveFeedback = z.infer<typeof SubjectiveFeedbackSchema>

/**
 * Feedback stored in the submissions.feedback jsonb column.
 * Maps section IDs to their subjective feedback.
 */
export const SubmissionFeedbackSchema = z.record(z.string(), SubjectiveFeedbackSchema)
export type SubmissionFeedback = z.infer<typeof SubmissionFeedbackSchema>

const DataSchemas = [
    FishingDataSchema,
    ClozeDataSchema,
    GrammarDataSchema,
    SentenceChoiceDataSchema,
    ReadingDataSchema,
    ListeningDataSchema,
    CustomDataSchema,
    SummaryDataSchema,
    TranslationDataSchema,
    WritingDataSchema,
] as const
export const QuizDataSchema = z.discriminatedUnion('type', DataSchemas)
export type QuizData = z.infer<typeof QuizDataSchema>
export type QuizDataType = QuizData['type']
export const QuizDataTypeSchema = z.union(DataSchemas.map(schema => schema.shape.type))
export const QuizItemsSchema = z.array(QuizDataSchema)
export type QuizItems = z.infer<typeof QuizItemsSchema>

/** The set of subjective question types that require AI marking. */
export const SUBJECTIVE_TYPES = ['summary', 'translation', 'writing'] as const
export type SubjectiveType = (typeof SUBJECTIVE_TYPES)[number]

export type Config = {
    /** @default 1 */
    start?: number,
    countSpaces?: number,
}
