import z from 'zod'

export const SUPPORTED_LANGS = ['zh', 'en', 'ja', 'nl'] as const
export type Lang = typeof SUPPORTED_LANGS[number]
export const LangSchema = z.enum(SUPPORTED_LANGS)
