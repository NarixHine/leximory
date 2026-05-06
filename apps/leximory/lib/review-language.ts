import { Lang } from '@repo/env/config'
import { getLanguageStrategy } from './languages/strategies'

export interface ReviewLanguageCopy {
    sourceLanguageName: string
    targetLanguageName: string
    actionLabel: string
    promptLabel: string
    answerLabel: string
    submissionLabel: string
    placeholder: string
}

export function getReviewLanguageCopy(lang: Lang): ReviewLanguageCopy {
    const targetLanguageName = getLanguageStrategy(lang).name
    const actionLabel = lang === 'zh' ? '译成文言文' : `翻译成${targetLanguageName}`

    return {
        sourceLanguageName: '中文',
        targetLanguageName,
        actionLabel,
        promptLabel: '中文提示',
        answerLabel: `${targetLanguageName}参考答案`,
        submissionLabel: `你的${targetLanguageName}翻译`,
        placeholder: `写出你的${targetLanguageName}翻译...`,
    }
}
