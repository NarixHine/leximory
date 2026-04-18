import { generateText } from 'ai'
import { getWordsWithin } from '@repo/supabase/word'
import { miniAI } from '@/server/ai/configs'
import { Lang } from '@repo/env/config'
import incrCommentaryQuota from '@repo/user/quota'
import { ACTION_QUOTA_COST } from '@repo/env/config'

interface GenerateTranslationsParams {
    date: string
    lang: string
    userId: string
    story: string
}

export async function generateTranslations({ date, lang, userId }: GenerateTranslationsParams): Promise<Array<{ chinese: string; answer: string; keyword: string }>> {
    // Check and increment quota with delayRevalidate
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.wordAnnotation, userId, true)) {
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
        return []
    }
    
    // Select 3-5 random words for translation exercises
    const selectedWords = words.sort(() => 0.5 - Math.random()).slice(0, Math.min(5, words.length))
    
    const { text } = await generateText({
        system: `Create translation exercises for language learners. Return ONLY a JSON array, no markdown, no explanation.

For each vocabulary word:
1. Create a natural Chinese sentence that includes the word's meaning
2. Provide the correct English translation
3. Identify the key word being tested

Format: [{"chinese": "...", "answer": "...", "keyword": "..."}]`,
        prompt: `Create ${selectedWords.length} translation exercises for these words:
${selectedWords.map((w, i) => {
    const parts = w.word.replace(/\{\{|\}\}/g, '').split('||')
    return `${i + 1}. ${parts[0]} - ${parts[2] || parts[1]}`
}).join('\n')}`,
        maxOutputTokens: 2000,
        ...miniAI,
    })
    
    try {
        // Extract JSON from the response
        const match = text.match(/\[[\s\S]*\]/)
        if (match) {
            return JSON.parse(match[0])
        }
        return []
    } catch (error) {
        console.error('Error parsing translations:', error)
        return []
    }
}
