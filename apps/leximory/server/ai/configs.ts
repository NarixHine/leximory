import { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google'

export const nanoAI = {
    model: 'xai/grok-4-fast-non-reasoning',
} as const

export const miniAI = {
    model: 'google/gemini-3-flash',
    providerOptions: {
        google: {
            thinkingConfig: {
                thinkingLevel: 'minimal',
                includeThoughts: true,
            },
            safetySettings: [
                {
                    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_HATE_SPEECH',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_HARASSMENT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_CIVIC_INTEGRITY',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_UNSPECIFIED',
                    threshold: 'BLOCK_NONE',
                },
            ],
        } satisfies GoogleGenerativeAIProviderOptions,
    },
} as const

export const thinkAI = {
    model: 'google/gemini-3-flash',
    providerOptions: {
        google: {
            safetySettings: [
                {
                    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_HATE_SPEECH',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_HARASSMENT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_CIVIC_INTEGRITY',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_UNSPECIFIED',
                    threshold: 'BLOCK_NONE',
                },
            ],
        } satisfies GoogleGenerativeAIProviderOptions,
    },
} as const

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
