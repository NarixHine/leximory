import type { ReactNode } from 'react'
import { Lang } from '../config'

export interface LanguageStrategy {
    type: Lang
    name: string
    FormattedReadingTime: (text: string) => ReactNode
}
