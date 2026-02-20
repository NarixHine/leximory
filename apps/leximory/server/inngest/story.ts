import { generateText } from 'ai'
import { inngest } from './client'
import { Lang } from '@repo/env/config'
import { getLanguageStrategy } from '@/lib/languages'
import { createTextWithData, getLibIdAndLangOfText } from '../db/text'
import moment from 'moment'
import getLanguageServerStrategy from '@/lib/languages/strategies.server'
import { miniAI } from '../ai/configs'
import { parseCommentParams } from '@/lib/comment'

const storyPrompt = async (comments: string[], lang: Lang, userId: string, storyStyle?: string) => ({
    system: `
        你是一位专业的${getLanguageStrategy(lang).name}教师，擅长为语言学习者创作包含指定词汇的短篇故事，帮助他们记忆单词。
        
        规则：
        1. 必须使用所有给定的词汇
        2. 故事长度尽可能短
        3. 故事要有趣且符合逻辑，易读性高
        4. 可以对词汇根据语境进行屈折变化，但不要改变词性；可以把诸如someone之类的代词用him/her/it/them等词代替
        5. 故事全文使用关键词所属语言
        6. 所有给定词汇必须在文中以<must></must>包裹（如<must>word</must>）
        7. 直接输出故事文本，前后不要附带其他内容
        8. 故事必须按照以下风格与内容创作：${storyStyle}
    `,
    prompt: `
        ${await getLanguageServerStrategy(lang).getAccentPrompt(userId)}
        请使用以下关键词创作一个短故事，全文使用${getLanguageStrategy(lang).name}。关键词在文中用<must></must>包裹来表示。
        关键词：
        ${comments.map(comment => `${parseCommentParams(comment)[1]}（义项：${parseCommentParams(comment)[2]}）`).join('\n')}
    `,
    maxOutputTokens: 6000,
    ...miniAI,
})

export const generateStory = inngest.createFunction(
    { id: 'generate-daily-story' },
    { event: 'app/story.requested' },
    async ({ step, event }) => {
        const { comments, userId, storyStyle } = event.data
        let textId: string
        if ('libId' in event.data) {
            const { libId } = event.data
            textId = await step.run('create-text', async () => {
                const { id } = await createTextWithData({ lib: libId, title: `${moment().format('MM/DD')} 小故事`, content: '> 生成中……' })
                return id
            })
        } else {
            textId = event.data.textId
        }

        const { lang } = await step.run('get-lang', async () => {
            return await getLibIdAndLangOfText({ id: textId })
        })

        // Generate the story
        const storyConfig = await step.run('get-story-prompt', async () => {
            return await storyPrompt(comments, lang, userId, storyStyle)
        })

        const { steps: [{ content }] } = await step.ai.wrap('generate-story', generateText, storyConfig)
        const text = content[0].type === 'text' ? content[0].text : ''

        // Trigger annotation process
        await step.sendEvent('annotate-story', {
            name: 'app/article.imported',
            data: {
                article: text,
                lang,
                textId,
                onlyComments: false,
                userId
            }
        })

        return { success: true }
    }
)
