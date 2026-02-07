import env, { IS_PROD } from '@repo/env'

export const PLANS = ['beginner', 'bilingual', 'polyglot', 'leximory'] as const
export type Plan = (typeof PLANS)[number]

export const ADMIN_UID = '3599113b-8407-46b7-85bc-4f9a1c425c59' as const

export const MAX_TTS_LENGTH = 10000
export const MAX_FILE_SIZE = 4.5 * 1024 * 1024
export const ALLOWED_IMAGE_REMOTE_PATTERNS = [
    {
        protocol: 'https',
        hostname: 'static01.nyt.com',
    },
] as const

export const SIGN_IN_URL = env.NEXT_PUBLIC_SIGN_IN_URL! as string
export const MARKETPLACE_PAGE_SIZE = 9 as const

export const EXAMPLE_SHARED_LIB = {
    id: '4c33b971',
    name: '📚 外刊泛读入门',
    lang: 'en',
    owner: '3599113b-8407-46b7-85bc-4f9a1c425c59',
    price: 0,
} as const

export const prefixUrl = (url: string) => `${IS_PROD ? env.NEXT_PUBLIC_LEXIMORY_URL : 'http://localhost:3001'}${url}`
export const prefixPathname = ({ path, next }: { path: string, next?: string }) => prefixUrl(next ? `${path}?next=${encodeURIComponent(next)}` : path)
export const EXAMPLE_EBOOK_LINK = '/library/1309fe3b/2dd46083' as const
export const BILIBILI_LINK = 'https://space.bilibili.com/3494376432994441/' as const
export const FYP_GITHUB_LINK = 'https://github.com/NarixHine/leximory/tree/main/app/fix-your-paper' as const
export const FYP_BLOG_LINK = 'https://hello.leximory.com/blog/fix-your-paper' as const

export const SUPPORTED_LANGS = ['zh', 'en', 'ja', 'nl'] as const
export type Lang = typeof SUPPORTED_LANGS[number]

export const PLAN_LABELS: Record<Plan, string> = {
    'beginner': 'Beginner—初学者',
    'bilingual': 'Bilingual—双语者',
    'polyglot': 'Polyglot—语言学人',
    'leximory': 'Leximory'
} as const
export const PLAN_COMMENTARY_QUOTA: Record<Plan, number> = {
    'beginner': 20,
    'bilingual': 100,
    'polyglot': 300,
    'leximory': 999
} as const
export const PLAN_AUDIO_QUOTA: Record<Plan, number> = {
    'beginner': 3,
    'bilingual': 10,
    'polyglot': 20,
    'leximory': 100
} as const
export const PLAN_DAILY_LEXICOIN: Record<Plan, number> = {
    'beginner': 1,
    'bilingual': 3,
    'polyglot': 10,
    'leximory': 100
} as const
export const ACTION_QUOTA_COST = {
    articleAnnotation: 1,
    wordAnnotation: 0.25,
    wordList: 1,
    story: 2,
    chat: 0.5,
    pouncepen: {
        import: 5,
        answer: 1,
        verdict: 1,
        genQuiz: 2,
        ask: 0.25,
        agent: 0.5,
    },
    quiz: {
        ask: 1,
        dictation: 1,
        genNote: 1,
    }
} as const

export const LIB_ACCESS_STATUS = {
    private: 0,
    public: 1,
} as const

export const maxArticleLength = (lang: Lang): number => {
    switch (lang) {
        case 'en': return 30000
        case 'ja': return 10000
        case 'zh': return 5000
        default: return 10000
    }
}


export type PaidTier = 'bilingual' | 'polyglot'
export const CREEM_PRODUCT_ID: Record<PaidTier, string> = IS_PROD ? {
    'bilingual': 'prod_4M08q7qmqNgs2WYgZGEJwG',
    'polyglot': 'prod_CpdFa9JGOurneLpm9Mhyu',
} as const : {
    'bilingual': 'prod_1rKh3LrLlDsk3F91W97Wjk',
    'polyglot': 'prod_4zgqjFSYwLoPNE7IRFw7QR',
} as const
export const getPlanFromProductId = (productId: typeof CREEM_PRODUCT_ID[keyof typeof CREEM_PRODUCT_ID]): PaidTier => {
    switch (productId) {
        case CREEM_PRODUCT_ID.bilingual:
            return 'bilingual'
        case CREEM_PRODUCT_ID.polyglot:
            return 'polyglot'
        default:
            throw new Error('Invalid product id')
    }
}

export const SECTION_NAME_MAP = {
    'listening': '听力',
    'grammar': '语法',
    'fishing': '词汇',
    'cloze': '完形填空',
    'reading': '阅读',
    'sentences': '六选四',
    'custom': '其他'
} as const

export const FORGET_CURVE = {
    '今天记忆': [0, -1],
    '一天前记忆': [1, 0],
    '四天前记忆': [4, 3],
    '七天前记忆': [7, 6],
    '十四天前记忆': [14, 13],
}
export type ForgetCurvePoint = keyof typeof FORGET_CURVE
