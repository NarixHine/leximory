export const ALPHABET_SET = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
] as const

export type AlphabeticalMarker = (typeof ALPHABET_SET)[number]

export const AI_GENERATABLE = ['cloze', 'fishing', 'reading'] as const
export type AIGeneratableType = (typeof AI_GENERATABLE)[number]
