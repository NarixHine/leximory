import { ENGLISH_SERIF } from '../fonts'
import { createLanguageStrategy } from './utils'

export const englishStrategy = createLanguageStrategy({
    type: 'en',
    name: '英语',
    FormattedReadingTime: (text: string) => {
        const wordCount = text.split(/\s+/).length
        return <span className={ENGLISH_SERIF.className}>{wordCount} words&nbsp;&nbsp;·&nbsp;&nbsp;{Math.ceil(wordCount / 170)}-minute read</span>
    }
})

export const chineseStrategy = createLanguageStrategy({
    type: 'zh',
    name: '中文',
})

export const japaneseStrategy = createLanguageStrategy({
    type: 'ja',
    name: '日语',
})

export const notListedStrategy = createLanguageStrategy({
    type: 'nl',
    name: '其他',
})
