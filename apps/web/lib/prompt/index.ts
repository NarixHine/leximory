import 'server-only'
import { ENGLISH_PROMPT } from './en.prompt'
import { NOT_LISTED_PROMPT } from './nl.prompt'
import { JAPANESE_PROMPT } from './ja.prompt'
import { CHINESE_PROMPT } from './zh.prompt'
import { SYSTEM_PROMPT } from './chat.prompt'

export const instruction: {
  [lang: string]: string
} = {
  nl: NOT_LISTED_PROMPT,
  en: ENGLISH_PROMPT,
  ja: JAPANESE_PROMPT,
  zh: CHINESE_PROMPT
}

export const CHAT_SYSTEM_PROMPT = SYSTEM_PROMPT
