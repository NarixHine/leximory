type QuizData = FishingData | ClozeData | GrammarData | SentenceChoiceData | ReadingData | ListeningData | CustomData

export type QuizDataType = QuizData['type']

export const AI_GEN_QUIZ_DATA_TYPE_LIST = ['fishing', 'cloze', '4/6', 'reading'] as const
export type AIGenQuizDataType = (typeof AI_GEN_QUIZ_DATA_TYPE_LIST)[number]

export type FishingData = {
    id: string
    text: string
    type: 'fishing'
    distractors: string[],
    markerSet: string[]
}

export type ClozeData = {
    id: string
    text: string
    type: 'cloze'
    questions: Array<{
        original: string
        distractors: string[]
    }>
}

export type GrammarData = {
    id: string
    text: string
    type: 'grammar'
    hints: Record<string, string | undefined>
}

export type SentenceChoiceData = {
    id: string
    text: string
    type: '4/6'
    distractors: string[]
}

export type Question = {
    q: string
    a: string[]
    correct: number // index of the correct answer
}

export type ReadingQuestion = Question

export type ReadingData = {
    id: string
    text: string
    type: 'reading'
    questions: ReadingQuestion[]
}

export type ListeningQuestion = Question & {
    transcript: string
}

export type ListeningData = {
    id: string
    type: 'listening'
    questions: ListeningQuestion[]
}

export type CustomData = {
    id: string
    type: 'custom'
    paper: string
    key: string
}

export type Config = {
    /** @default 1 */
    start?: number,
    countSpaces?: number,
}

export default QuizData
