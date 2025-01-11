import env from './env'

export const exampleSharedLib = {
    id: '210fdc4d',
    name: '📚 100-Day Intensive Input',
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
}

export const welcomeMap: Record<Lang, string> = {
    'zh': '{{欢迎||欢迎||欢迎来到你的新文言文文库！}}',
    'en': '{{Welcome||welcome||Welcome to your new English library!}}',
    'ja': '{{ようこそ||ようこそ||新しい日本語ライブラリへようこそ！}}',
    'nl': '{{Welcome||welcome||Welcome to your new library!}}'
}

type ColorOption = 'primary' | 'warning' | 'danger'
export const colorMap: Record<string, ColorOption> = {
    '文言文': 'primary',
    '英文': 'primary',
    '日文': 'primary',
    '其他': 'primary',
    '共享': 'warning',
    '只读': 'danger'
}

export const libAccessStatusMap = {
    private: 0,
    public: 1,
} as const

export const prefixUrl = (url: string) => `${env.NEXT_PUBLIC_URL}${url}`

export const accessOptions = [
    { name: 'private' as const, label: '私有（仅自己及小组成员可见）' },
    { name: 'public' as const, label: '公开（所有用户都可见，且显示于文库集市中）' }
]

export const maxArticleLength = (lang: Lang): number => {
    switch (lang) {
        case 'en': return 10000
        case 'ja':
        case 'zh': return 3000
        default: return 5000
    }
}
