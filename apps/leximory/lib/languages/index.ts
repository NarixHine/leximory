import { Lang } from '@repo/env/config'
import { chineseStrategy, englishStrategy, frenchStrategy, japaneseStrategy, notListedStrategy } from './strategies'
import { LanguageStrategy } from './types'

export const languageStrategies = [
    englishStrategy,
    frenchStrategy,
    chineseStrategy,
    japaneseStrategy,
    notListedStrategy,
]

export function getLanguageStrategy(lang: Lang): LanguageStrategy {
    return languageStrategies.find(strategy => strategy.type === lang) ?? notListedStrategy
}
