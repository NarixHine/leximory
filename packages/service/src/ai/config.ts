import 'server-only'
import { LanguageModel } from 'ai'
import { gateway } from '@ai-sdk/gateway'

type AIConfig = {
    model: LanguageModel
    temperature?: number
}

export const FLASH_AI: AIConfig = {
    model: gateway('xai/grok-4-fast-non-reasoning'),
}

export const FILE_AI: AIConfig = {
    model: gateway('google/gemini-3-flash'),
}

export const SMART_AI: AIConfig = {
    model: gateway('google/gemini-3-flash'),
}