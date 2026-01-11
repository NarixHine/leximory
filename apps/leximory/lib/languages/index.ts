import { Lang } from '../config'
import { chineseStrategy, englishStrategy, japaneseStrategy, notListedStrategy } from './strategies'
import { LanguageStrategy } from './types'

export const languageStrategies = [
    englishStrategy,
    chineseStrategy,
    japaneseStrategy,
    notListedStrategy
]

export function getLanguageStrategy(lang: Lang): LanguageStrategy {
    return languageStrategies.find(strategy => strategy.type === lang) ?? notListedStrategy
}
