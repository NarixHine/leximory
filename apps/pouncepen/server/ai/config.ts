import 'server-only'
import { LanguageModel } from 'ai'
import { gateway } from '@ai-sdk/gateway'

type AIConfig = {
    model: LanguageModel
    temperature?: number
}

export const FLASH_AI: AIConfig = {
    model: gateway('openai/gpt-5.4-mini'),
}

export const FILE_AI: AIConfig = {
    model: gateway('google/gemini-3.5-flash'),
}

export const SMART_AI: AIConfig = {
    model: gateway('google/gemini-3.5-flash'),
}
