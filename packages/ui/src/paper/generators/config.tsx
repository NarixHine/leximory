import { ReactNode } from 'react'
import { QuizDataType } from '@repo/schema/paper'
import {
    ScalesIcon,
    HeadphonesIcon,
    FishIcon,
    CheckerboardIcon,
    BookOpenTextIcon,
    ArticleIcon,
    ArticleNyTimesIcon,
} from '@phosphor-icons/react/ssr'
import { z } from '@repo/schema'

export const ALPHABET_SET = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
] as const
export type AlphabeticalMarker = (typeof ALPHABET_SET)[number]
export const ALPHABET_ELEMENTS = ALPHABET_SET.map((letter) => <span key={letter} className='font-bold'>{letter}.</span>)

export const AI_GENERATABLE = ['cloze', 'fishing', 'reading'] as const
export type AIGeneratableType = (typeof AI_GENERATABLE)[number]
export const GeneratableTypeSchema = z.enum(AI_GENERATABLE)

export const ICON_MAP: Record<QuizDataType, ReactNode> = {
    'listening': <HeadphonesIcon />,
    'grammar': <ScalesIcon />,
    'fishing': <FishIcon />,
    'cloze': <CheckerboardIcon />,
    'reading': <BookOpenTextIcon />,
    'sentences': <ArticleIcon />,
    'custom': <ArticleNyTimesIcon />
}
