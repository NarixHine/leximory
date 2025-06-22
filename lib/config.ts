import env, { isProd } from './env'
import { google, GoogleGenerativeAIProviderOptions } from '@ai-sdk/google'
import { Plan } from '@/server/auth/quota'

export const ADMIN_UID = '3599113b-8407-46b7-85bc-4f9a1c425c59' as const

export const MAX_FILE_SIZE = 4.5 * 1024 * 1024

export const SIGN_IN_URL = '/login' as const

export const TIMES_PAGE_SIZE = 7 as const

export const MAX_TTS_LENGTH = 10000
export const elevenLabsVoiceConfig = {
    'BrE': {
        voice: '0sGQQaD2G2X1s87kHM5b',
        options: {
        }
    },
    'AmE': {
        voice: 'Z3R5wn05IrDiVCyEkUrK',
        options: {
            voice_settings: {
                stability: 0.4,
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
} as const

export const exampleSharedLib = {
    id: '4c33b971',
    name: '📚 外刊泛读入门',
    lang: 'en',
    owner: '3599113b-8407-46b7-85bc-4f9a1c425c59',
    price: 0,
    readers: 324
} as const

export const exampleEbookLink = '/library/1309fe3b/2dd46083' as const
export const bilibiliLink = 'https://space.bilibili.com/3494376432994441/' as const
export const fixYourPaperGitHubLink = 'https://github.com/NarixHine/leximory/tree/main/app/fix-your-paper' as const
export const fixYourPaperBlogLink = 'https://hello.leximory.com/blog/fix-your-paper' as const

export const supportedLangs = ['zh', 'en', 'ja', 'nl'] as const
export type Lang = typeof supportedLangs[number]

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
    'image-gen': google('gemini-2.0-flash-preview-image-generation', {
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
    'flash-2.5': google('gemini-2.5-flash', {
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
    'flash-2.5-search': google('gemini-2.5-flash', {
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
    'pro-2.5': google('gemini-2.5-pro', {
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
export const langMap: Record<Lang, string> = {
    'zh': '文言文',
    'en': '英文',
    'ja': '日文',
    'nl': '其他'
} as const

export const planMap: Record<Plan, string> = {
    'beginner': 'Beginner—初学者',
    'bilingual': 'Bilingual—双语者',
    'polyglot': 'Polyglot—语言学人',
    'leximory': 'Leximory'
} as const

export const dailyLexicoinClaimMap: Record<Plan, number> = {
    'beginner': 1,
    'bilingual': 3,
    'polyglot': 10,
    'leximory': 100
} as const

export const langMaxChunkSizeMap: Record<Lang, number> = {
    'zh': 500,
    'en': 5000,
    'ja': 1000,
    'nl': 2000
} as const

export const welcomeMap: Record<Lang, string> = {
    'zh': '{{欢迎！||欢迎||欢迎来到你的新文言文文库！}}',
    'en': '{{Welcome!||welcome||Welcome to your new English library!}}',
    'ja': '{{ようこそ！||ようこそ||新しい日本語ライブラリへようこそ！}}',
    'nl': '{{Welcome!||welcome||Welcome to your new library!}}'
} as const

export const libAccessStatusMap = {
    private: 0,
    public: 1,
} as const

export const prefixUrl = (url: string) => `${isProd ? env.NEXT_PUBLIC_URL : 'http://localhost:3000'}${url}`

export const maxArticleLength = (lang: Lang): number => {
    switch (lang) {
        case 'en': return 20000
        case 'ja': return 6000
        case 'zh': return 4000
        default: return 10000
    }
}

export const MARKETPLACE_PAGE_SIZE = 9

export type PaidTier = 'bilingual' | 'polyglot'
export const creemProductIdMap: Record<PaidTier, string> = isProd ? {
    'bilingual': 'prod_4M08q7qmqNgs2WYgZGEJwG',
    'polyglot': 'prod_CpdFa9JGOurneLpm9Mhyu',
} as const : {
    'bilingual': 'prod_1rKh3LrLlDsk3F91W97Wjk',
    'polyglot': 'prod_4zgqjFSYwLoPNE7IRFw7QR',
} as const
export const getPlanFromProductId = (productId: typeof creemProductIdMap[keyof typeof creemProductIdMap]): PaidTier => {
    switch (productId) {
        case creemProductIdMap.bilingual:
            return 'bilingual'
        case creemProductIdMap.polyglot:
            return 'polyglot'
        default:
            throw new Error('Invalid product id')
    }
}

export const forgetCurve = {
    '今天记忆': [0, -1],
    '一天前记忆': [1, 0],
    '四天前记忆': [4, 3],
    '七天前记忆': [7, 6],
    '十四天前记忆': [14, 13],
}

export type ForgetCurvePoint = keyof typeof forgetCurve

