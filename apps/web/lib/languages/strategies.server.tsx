import 'server-only'
import { getAccentPreference } from '@/server/db/preference'
import { createLanguageServerStrategy } from './utils'

export const englishStrategy = createLanguageServerStrategy({
    type: 'en',
    async getAccentPrompt(userId) {
        const accent = await getAccentPreference({ userId })
        return `用户偏好：${accent}。请使用${accent}拼写、发音和语汇。`
    }
})

export const chineseStrategy = createLanguageServerStrategy({
    type: 'zh',
})

export const japaneseStrategy = createLanguageServerStrategy({
    type: 'ja',
})

export const notListedStrategy = createLanguageServerStrategy({
    type: 'nl',
})

export const languageServerStrategies = [
    englishStrategy,
    chineseStrategy,
    japaneseStrategy,
    notListedStrategy
]

export default function getLanguageServerStrategy(lang: string) {
    return languageServerStrategies.find(strategy => strategy.type === lang) ?? notListedStrategy
}
