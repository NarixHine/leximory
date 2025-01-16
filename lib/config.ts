import env from './env'

export const elevenLabsVoice = {
    'BrE': 'npp2mvZp4jbUrUkhYg8e',
    'AmE': '5l5f8iK3YPeGga21rQIX',
} as const

export const exampleSharedLib = {
    id: '4c33b971',
    name: '📚 外刊泛读入门',
    lang: 'en',
    owner: 'user_2frwUkCccvHgoC1axAzZN2KECxt'
} as const

export const supportedLangs = ['zh', 'en', 'ja', 'nl'] as const
export type Lang = typeof supportedLangs[number]

export const langMap: Record<Lang, string> = {
    'zh': '文言文',
    'en': '英文',
    'ja': '日文',
    'nl': '其他'
} as const

export const welcomeMap: Record<Lang, string> = {
    'zh': '{{欢迎||欢迎||欢迎来到你的新文言文文库！}}',
    'en': '{{Welcome||welcome||Welcome to your new English library!}}',
    'ja': '{{ようこそ||ようこそ||新しい日本語ライブラリへようこそ！}}',
    'nl': '{{Welcome||welcome||Welcome to your new library!}}'
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
        case 'en': return 10000
        case 'ja':
        case 'zh': return 3000
        default: return 5000
    }
}
