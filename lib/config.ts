import env, { isProd } from './env'

export const PLANS = ['beginner', 'bilingual', 'polyglot', 'leximory'] as const
export type Plan = (typeof PLANS)[number]

export const ADMIN_UID = '3599113b-8407-46b7-85bc-4f9a1c425c59' as const

export const MAX_TTS_LENGTH = 10000
export const MAX_FILE_SIZE = 4.5 * 1024 * 1024

export const SIGN_IN_URL = '/login' as const

export const TIMES_PAGE_SIZE = 9 as const

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



export const libAccessStatusMap = {
    private: 0,
    public: 1,
} as const

export const prefixUrl = (url: string) => `${isProd ? env.NEXT_PUBLIC_URL : 'http://localhost:3000'}${url}`

export const maxArticleLength = (lang: Lang): number => {
    switch (lang) {
        case 'en': return 30000
        case 'ja': return 10000
        case 'zh': return 5000
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

