import { generateText } from 'ai'
import { getWordsWithin } from '@repo/supabase/word'
import { getLanguageStrategy } from '@/lib/languages/strategies'
import { parseCommentParams } from '@/lib/comment'
import { miniAI } from '@/server/ai/configs'
import getLanguageServerStrategy from '@/lib/languages/strategies.server'
import { Lang } from '@repo/env/config'
import incrCommentaryQuota from '@repo/user/quota'
import { ACTION_QUOTA_COST } from '@repo/env/config'

interface GenerateStoryParams {
    date: string
    lang: string
    userId: string
}

export async function generateStory({ date, lang, userId }: GenerateStoryParams): Promise<string> {
    // Check and increment quota with delayRevalidate
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.story, userId, true)) {
        throw new Error('Daily quota exceeded')
    }

    // Get words for the date
    const targetDate = new Date(date)
    const today = new Date()
    const daysDiff = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24))
    
    const words = await getWordsWithin({
        fromDayAgo: daysDiff,
        toDayAgo: daysDiff - 1,
        userId,
    })
    
    if (words.length === 0) {
        throw new Error('No words found for the specified date')
    }
    
    const languageName = getLanguageStrategy(lang as Lang).name
    
    // Parse words to get lemmas
    const parsedWords = words.map(w => parseCommentParams(w.word))
    
    const { text } = await generateText({
        system: `
            你是一位专业的${languageName}教师，擅长为语言学习者创作包含指定词汇的短篇故事，帮助他们记忆单词。
            
            规则：
            1. 必须使用所有给定的词汇
            2. 故事长度尽可能短
            3. 故事要有趣且符合逻辑，易读性高
            4. 可以对词汇根据语境进行屈折变化，但不要改变词性；可以把诸如someone之类的代词用him/her/it/them等词代替
            5. 故事全文使用关键词所属语言
            6. 所有给定词汇必须在文中以<must></must>包裹（如<must>word</must>）
            7. 直接输出故事文本，前后不要附带其他内容
        `,
        prompt: `
            ${await getLanguageServerStrategy(lang as Lang).getAccentPrompt(userId)}
            请使用以下关键词创作一个短故事，全文使用${languageName}。关键词在文中用<must></must>包裹来表示。
            关键词：
            ${parsedWords.map((parts, i) => `${i + 1}. ${parts[1]}（义项：${parts[2]}）`).join('\n')}
        `,
        maxOutputTokens: 6000,
        ...miniAI,
    })
    
    return text
}
