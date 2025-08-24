import { google, GoogleGenerativeAIProviderOptions } from '@ai-sdk/google'
import { GoogleVertexImageProviderOptions, vertex } from '@ai-sdk/google-vertex'
import { openai, OpenAIResponsesProviderOptions } from '@ai-sdk/openai'
import { LanguageModel, ToolSet, ToolChoice, ImageModel } from 'ai'

type AI_CONFIG = {
    model: LanguageModel,
    providerOptions?: {
        google?: GoogleGenerativeAIProviderOptions,
        openai?: OpenAIResponsesProviderOptions
    },
    tools?: ToolSet,
    toolChoice?: ToolChoice<NoInfer<ToolSet>>,
}

type VISION_AI_CONFIG = {
    model: ImageModel,
    aspectRatio?: `${number}:${number}`,
    providerOptions?: {
        google?: GoogleVertexImageProviderOptions,
    }
    maxImagesPerCall?: number
}

export const nanoAI = {
    model: 'openai/gpt-5-nano',
    providerOptions: {
        openai: {
            reasoningEffort: 'minimal',
            reasoningSummary: 'auto'
        }
    }
} as const satisfies AI_CONFIG

export const miniAI = {
    model: 'openai/gpt-5-mini',
    providerOptions: {
        openai: {
            reasoningEffort: 'minimal',
            reasoningSummary: 'auto'
        }
    }
} as const satisfies AI_CONFIG

export const thinkAI = {
    model: 'openai/gpt-5-mini',
    providerOptions: {
        openai: {
            reasoningSummary: 'auto',
            reasoningEffort: 'low'
        }
    }
} as const satisfies AI_CONFIG

export const flashAI = {
    model: google('gemini-2.5-flash'),
    providerOptions: {
        google: {
            thinkingConfig: {
                thinkingBudget: 0
            },
            safetySettings: [{
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_NONE',
            }, {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_NONE',
            }, {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_NONE',
            }, {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_NONE',
            }, {
                category: 'HARM_CATEGORY_CIVIC_INTEGRITY',
                threshold: 'BLOCK_NONE',
            }],
        }
    }
} as const satisfies AI_CONFIG

export const searchAI = {
    model: 'openai/gpt-5-mini',
    providerOptions: {
        openai: {
            reasoningEffort: 'minimal',
            reasoningSummary: 'auto'
        }
    },
    tools: {
        web_search_preview: openai.tools.webSearchPreview({}),
    },
    // Force web search tool:
    toolChoice: { type: 'tool', toolName: 'web_search_preview' },
} as const satisfies AI_CONFIG

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
