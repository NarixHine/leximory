import { Lang } from '@repo/env/config'

export const languageWelcomeWords: Record<Lang, string> = {
    en: '{{Welcome!||welcome||Welcome to your new English library!}}',
    zh: '{{欢迎！||欢迎||欢迎来到你的新文言文文库！}}',
    ja: '{{ようこそ！||ようこそ||新しい日本語ライブラリへようこそ！}}',
    nl: '{{Welcome!||welcome||Welcome to your new library!}}'
}

export function getWelcomeWord(lang: Lang): string {
    return languageWelcomeWords[lang] || languageWelcomeWords.nl
}

export function getLanguageName(lang: Lang): string {
    const names: Record<Lang, string> = {
        en: '英文',
        zh: '文言文',
        ja: '日文',
        nl: '其他'
    }
    return names[lang] || '其他'
}
