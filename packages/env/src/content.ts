import type { Lang } from './config'
export const MAX_FILE_SIZE = 4.5 * 1024 * 1024
export const maxArticleLength = (lang: Lang): number => {
    switch (lang) {
        case 'en':
        case 'fr':
            return 30000
        case 'ja':
            return 10000
        case 'zh':
            return 5000
        default:
            return 10000
    }
}
