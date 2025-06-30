import { createVertex } from '@ai-sdk/google-vertex'
import { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google'
import { Lang } from '@/lib/config'
import env from '@/lib/env'

const vertex = createVertex({
    project: env.GOOGLE_VERTEX_PROJECT,
    location: env.GOOGLE_VERTEX_LOCATION,
    googleAuthOptions: {
        credentials: {
            client_email: env.GOOGLE_VERTEX_CLIENT_EMAIL,
            private_key: env.GOOGLE_VERTEX_PRIVATE_KEY,
        },
    },
})

export const noThinkingConfig = {
    providerOptions: {
        google: {
            thinkingConfig: {
                thinkingBudget: 0
            }
        } satisfies GoogleGenerativeAIProviderOptions
    }
}

export const googleModels = {
    'image-gen': vertex.image('imagen-4.0-generate-preview-06-06', { maxImagesPerCall: 1 }),
    'flash-2.5': vertex('gemini-2.5-flash', {
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
    }),
    'flash-2.5-search': vertex('gemini-2.5-flash', {
        useSearchGrounding: true,
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
        }]
    }),
    'pro-2.5': vertex('gemini-2.5-pro', {
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
    }),
}

export const getBestArticleAnnotationModel = (lang: Lang) => {
    switch (lang) {
        case 'zh': return googleModels['flash-2.5']
        case 'en': return googleModels['flash-2.5']
        case 'nl': return googleModels['flash-2.5']
        case 'ja': return googleModels['flash-2.5']
    }
}

export const getBestCommentaryModel = (lang: Lang) => {
    switch (lang) {
        case 'zh': return googleModels['flash-2.5']
        case 'en': return googleModels['flash-2.5']
        case 'nl': return googleModels['flash-2.5']
        case 'ja': return googleModels['flash-2.5']
    }
}

export const elevenLabsVoiceConfig = {
    'BrE': {
        voice: 'KA3yMJop9i539YKcyb0m',
        options: {
            voice_settings: {
                stability: 0.45,
                similarity_boost: 0.75,
                speed: 1.08,
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
