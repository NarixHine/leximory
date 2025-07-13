import type { ReactNode } from 'react'
import { Lang } from '../config'

export interface LanguageStrategy {
    type: Lang
    name: string
    welcome: string
    maxChunkSize: number
    maxArticleLength: number
    FormattedReadingTime?: (text: string) => ReactNode
    exampleSentencePrompt: string
}

export interface LanguageServerStrategy {
    type: Lang
    getAccentPrompt: (userId: string) => string | Promise<string>
}
