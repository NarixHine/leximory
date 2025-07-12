import { englishStrategy, chineseStrategy, japaneseStrategy, notListedStrategy } from './strategies'

export const languageStrategies = {
    en: englishStrategy,
    zh: chineseStrategy,
    ja: japaneseStrategy,
    nl: notListedStrategy,
}   
