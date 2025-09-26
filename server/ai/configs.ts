import { GoogleVertexImageProviderOptions, vertex } from '@ai-sdk/google-vertex'
import { openai } from '@ai-sdk/openai'
import { ImageModel } from 'ai'

type VISION_AI_CONFIG = {
    model: ImageModel,
    aspectRatio?: `${number}:${number}`,
    providerOptions?: {
        google?: GoogleVertexImageProviderOptions,
    }
    maxImagesPerCall?: number
}

export const nanoAI = {
    model: 'xai/grok-4-fast-non-reasoning',
} as const

export const miniAI = {
    model: 'xai/grok-4-fast-non-reasoning',
} as const

export const thinkAI = {
    model: 'xai/grok-4-fast-reasoning',
    providerOptions: {
        openai: {
            reasoningSummary: 'auto',
            reasoningEffort: 'low'
        }
    }
} as const

export const searchAI = {
    model: 'openai/gpt-5-mini',
    providerOptions: {
        openai: {
            reasoningEffort: 'minimal',
            reasoningSummary: 'auto'
        }
    },
    tools: {
        web_search: openai.tools.webSearchPreview({
            searchContextSize: 'high',
        }),
    },
    // Force web search tool:
    toolChoice: { type: 'tool', toolName: 'web_search' },
} as const

export const landscapeImageAI = {
    model: vertex.image('imagen-4.0-generate-preview-06-06'),
    maxImagesPerCall: 1,
    aspectRatio: '16:9'
} as const satisfies VISION_AI_CONFIG


export const elevenLabsVoiceConfig = {
    'BrE': {
        voice: 'k9kxNvqF1UqyrwvqNxtp',
        options: {
            voice_settings: {
                stability: 0.45,
                similarity_boost: 0.75,
                speed: 1.05,
            }
        }
    },
    'AmE': {
        voice: 'Z3R5wn05IrDiVCyEkUrK',
        options: {
            voice_settings: {
                stability: 0.3,
                similarity_boost: 0.4,
                speed: 1.07,
            }
        }
    },
    'ja': {
        voice: 'GxxMAMfQkDlnqjpzjLHH',
        options: {
        }
    },
    'zh': {
        voice: 'FjfxJryh105iTLL4ktHB',
        options: {
        }
    },
    'nl': {
        voice: '0sGQQaD2G2X1s87kHM5b',
        options: {
        }
    },
} as const satisfies Record<string, {
    voice: string, options: Partial<{
        voice_settings: Partial<{
            stability: number,
            similarity_boost: number,
            speed: number
        }>
    }>
}>
