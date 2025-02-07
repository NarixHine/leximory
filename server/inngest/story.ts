import { generateText } from 'ai'
import { inngest } from './client'
import { Lang, getBestModel } from '@/lib/config'
import { accentPreferencePrompt } from '@/lib/prompt'
import { createTextWithData, getLibIdAndLangOfText } from '../db/text'
import moment from 'moment'
import { parseComment } from '@/lib/lang'

const storyPrompt = async (comments: string[], lang: Lang, userId: string) => ({
    system: `
        你是一位专业的语言教师，擅长为语言学习者创作包含指定词汇的短篇故事，帮助他们记忆单词。
        
        规则：
        1. 必须使用所有给定的词汇
        2. 故事长度尽可能短
        3. 故事要有趣且符合逻辑
        4. 语言难度要简易
        5. 确保故事内容无任何不当内容
    `,
    prompt: `
        ${lang === 'en' ? await accentPreferencePrompt({ lang, userId }) : ''}
        请使用以下词汇创作一个短篇故事，用关键词所属语言创作。以下关键词用双重大括号（{{ }}）包裹：
        ${comments.map(comment => `${parseComment(comment)[1]}（义项：${parseComment(comment)[2]}）`).join('\n')}
    `,
    maxTokens: 2000
})

export const generateStory = inngest.createFunction(
    { id: 'generate-daily-story' },
    { event: 'app/story.requested' },
    async ({ step, event }) => {
        const { comments, userId, libId } = event.data

        const { id: textId } = await step.run('create-text', async () => {
            return await createTextWithData({ lib: libId, title: `${moment().format('MM/DD')}小故事`, content: '> 生成中...' })
        })

        const { lang } = await step.run('get-lang', async () => {
            return await getLibIdAndLangOfText({ id: textId })
        })

        // Generate the story
        const storyConfig = await step.run('get-story-prompt', async () => {
            return await storyPrompt(comments, lang, userId)
        })

        const story = await step.ai.wrap('generate-story', generateText, {
            model: await getBestModel(lang),
            ...storyConfig
        })

        // Trigger annotation process
        await step.sendEvent('annotate-story', {
            name: 'app/article.imported',
            data: {
                article: story.text,
                lang,
                textId,
                onlyComments: false,
                userId
            }
        })

        return { success: true }
    }
)
