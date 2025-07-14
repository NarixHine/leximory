import QuizData from '@/components/editory/generators/types'

export interface TimesSummaryData {
    date: string
    cover: string
}

export interface TimesData extends TimesSummaryData {
    novel: string
    news: string
    audio: string | null
    quiz: QuizData | null
    is_sequel: boolean
}

export interface TimesDataWithRaw extends TimesData {
    raw_news: string
}
