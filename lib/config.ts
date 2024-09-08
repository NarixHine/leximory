export const supportedLangs = ['zh', 'en', 'ja', 'nl']
export type Lang = 'zh' | 'en' | 'ja' | 'nl'
export const langMap: {
    [key: string]: '文言文' | '英文' | '日文' | '其他'
} = {
    'zh': '文言文',
    'en': '英文',
    'ja': '日文',
    'nl': '其他'
}

export const welcomeMap: {
    [key: string]: string
} = {
    'zh': '{{欢迎||欢迎||欢迎来到你的新文言文文库！}}',
    'en': '{{Welcome||welcome||Welcome to your new English library!}}',
    'ja': '{{ようこそ||ようこそ||新しい日本語ライブラリへようこそ！}}',
    'nl': '{{Welcome||welcome||Welcome to your new library!}}'
}

export const colorMap: {
    [key: string]: 'primary' | 'warning' | 'danger'
} = {
    '文言文': 'primary',
    '英文': 'primary',
    '日文': 'primary',
    '其他': 'primary',
    '共享': 'warning',
    '只读': 'danger'
}

export const libAccessStatusMap: Record<'private' | 'public', number> = {
    private: 0,
    public: 1,
}

export const prefixUrl = (url: string) => `${process.env.NEXT_PUBLIC_URL}${url}`

export const accessOptions = [{
    name: 'private',
    label: '私有（仅自己及小组成员可见）'
}, {
    name: 'public',
    label: '公开（所有用户都可见）'
}]

export const maxArticleLength = (lang: string) => {
    if (lang === 'en')
        return 10000
    else if (lang === 'ja')
        return 3000
    else if (lang === 'zh')
        return 3000
    return 5000
}
