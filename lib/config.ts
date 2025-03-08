import env from './env'
import { google } from '@ai-sdk/google'
import { Plan } from '@/server/auth/quota'

export const elevenLabsVoice = {
    'BrE': 'rfkTsdZrVWEVhDycUYn9',
    'AmE': 'Z3R5wn05IrDiVCyEkUrK',
} as const

export const exampleSharedLib = {
    id: '4c33b971',
    name: '📚 外刊泛读入门',
    lang: 'en',
    owner: 'user_2frwUkCccvHgoC1axAzZN2KECxt',
    price: 0
} as const

export const exampleEbookLink = '/library/3e4f1126/5c4e8e4e' as const
export const bilibiliLink = 'https://space.bilibili.com/3494376432994441/' as const

export const supportedLangs = ['zh', 'en', 'ja', 'nl'] as const
export type Lang = typeof supportedLangs[number]

export const googleModel = google('gemini-2.0-flash-001', {
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
    }]
})

export const getBestModel = async (lang: Lang) => {
    switch (lang) {
        case 'zh': return googleModel
        case 'en': return googleModel
        case 'nl': return googleModel
        case 'ja': return googleModel
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
    'polyglot': 5,
    'leximory': 100
} as const

export const langMaxChunkSizeMap: Record<Lang, number> = {
    'zh': 300,
    'en': 3000,
    'ja': 1000,
    'nl': 1000
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

export const prefixUrl = (url: string) => `${env.NEXT_PUBLIC_URL}${url}`

export const accessOptions = [
    { name: 'private' as const, label: '私有（仅自己及小组成员可见）' },
    { name: 'public' as const, label: '公开（所有用户都可见，且显示于文库集市中）' }
] as const

export const maxArticleLength = (lang: Lang): number => {
    switch (lang) {
        case 'en': return 20000
        case 'ja':
        case 'zh': return 3000
        default: return 5000
    }
}

export const MARKETPLACE_PAGE_SIZE = 6
