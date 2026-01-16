import QuizData, { QuizDataType } from './types'
import { PiArticleDuotone, PiArticleNyTimesDuotone, PiBookOpenTextDuotone, PiCheckerboardDuotone, PiFishDuotone, PiHeadphonesDuotone, PiScalesDuotone } from 'react-icons/pi'
import { ReactNode } from 'react'
import { nanoid } from 'nanoid'

export const ALPHABET_SET = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
]

export const NAME_MAP: Record<QuizDataType, string> = {
    'listening': 'Listening',
    'grammar': 'Grammar',
    'fishing': 'Vocabulary',
    'cloze': 'Cloze',
    'reading': 'Reading',
    '4/6': 'Sentence Choice',
    'custom': 'Custom Text'
} as const

export const AI_GENERATABLE = ['cloze', 'fishing', 'reading'] as const
export type AIGeneratableType = (typeof AI_GENERATABLE)[number]

export const ICON_MAP: Record<QuizDataType, ReactNode> = {
    'listening': <PiHeadphonesDuotone />,
    'grammar': <PiScalesDuotone />,
    'fishing': <PiFishDuotone />,
    'cloze': <PiCheckerboardDuotone />,
    'reading': <PiBookOpenTextDuotone />,
    '4/6': <PiArticleDuotone />,
    'custom': <PiArticleNyTimesDuotone />
}
