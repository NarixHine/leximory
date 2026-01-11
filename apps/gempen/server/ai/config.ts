import 'server-only'
import { LanguageModel } from 'ai'
import { gateway } from '@ai-sdk/gateway'

type AIConfig = {
    model: LanguageModel
    temperature: number
}

export const FLASH_AI: AIConfig = {
    model: gateway('xai/grok-4-fast-non-reasoning'),
    temperature: 0
}

export const FILE_AI: AIConfig = {
    model: gateway('google/gemini-3-flash'),
    temperature: 0.3
}

export const SMART_AI: AIConfig = {
    model: gateway('openai/gpt-5.2'),
    temperature: 0.3
}
