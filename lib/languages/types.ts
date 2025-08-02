import type { ReactNode } from 'react'
import { Lang } from '../config'

export interface LanguageStrategy {
    type: Lang
    name: string
    // for corpus
    welcome: string
    // for annotation
    maxChunkSize: number
    maxArticleLength: number
    exampleSentencePrompt: string
    // for UI
    FormattedReadingTime?: (text: string) => ReactNode
    // for ebook
    isRTL: boolean
    lineHeight: string
    pageFormat: (page: number, total: number) => string
}

export interface LanguageServerStrategy {
    type: Lang
    // for annotation
    getAccentPrompt: (userId: string) => string | Promise<string>
}
