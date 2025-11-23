export const nanoAI = {
    model: 'xai/grok-4-fast-non-reasoning',
} as const

export const miniAI = {
    model: 'google/gemini-2.5-flash',
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
