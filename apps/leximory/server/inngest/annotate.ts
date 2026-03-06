import { inngest } from './client'
import { prefixUrl } from '@repo/env/config'
import { getLanguageStrategy } from '@/lib/languages'
import { getLibIdAndLangOfText, setTextAnnotationProgress, updateText } from '../db/text'
import { getSubsStatus } from '../db/subs'
import { articleAnnotationPrompt } from '../ai/annotate'
import { nanoAI } from '../ai/configs'
import { generateText } from 'ai'
import { revalidateTag } from 'next/cache'
import { fixDumbPunctuation } from '@/lib/comment'

const topicsPrompt = (input: string) => ({
    system: `
    用1~3个中文标签表示下文的话题或关键词。每个关键词间用||分隔。
    `,
    prompt: `请从下文提取出1~3个中文标签表示下文的话题或关键词：
    
    ${input}`,
    maxOutputTokens: 100,
    ...nanoAI
})

const emojiPrompt = (input: string) => ({
    system: `你是一个emoji选择器。根据文章的主题和氛围，选择一个最能代表这篇文章的emoji且新颖不落俗套。只输出一个emoji，不要输出任何其他内容。禁止选取可能引起强烈视觉不适的emoji，即禁止选取任何昆虫emoji。`,
    prompt: `为以下文章选择一个有表现力的emoji：\n\n${input.slice(0, 500)}`,
    maxOutputTokens: 20,
    ...nanoAI
})

const titlePrompt = (input: string) => ({
    system: `你是一个标题生成器。根据文章内容生成一个简洁、准确、有吸引力的标题。用文章的原语言输出标题。只输出标题文本，不要输出任何其他内容、引号或标点符号包裹。`,
    prompt: `为以下文章生成一个标题：\n\n${input.slice(0, 2000)}`,
    maxOutputTokens: 60,
    ...nanoAI
})

const chunkText = (text: string, maxLength: number): string[] => {
    // Handle edge cases
    if (!text) return []
    if (text.length <= maxLength) return [text]

    const chunks: string[] = []

    // Split by paragraphs (double newline)
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim())
    let currentChunk = ''

    for (const paragraph of paragraphs) {
        // Case 1: Single paragraph longer than maxLength
        if (paragraph.length >= maxLength) {
            // Push existing chunk if any
            if (currentChunk) {
                chunks.push(currentChunk.trim())
                currentChunk = ''
            }

            // Split long paragraph by sentences when possible
            const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph]

            let sentenceChunk = ''
            for (const sentence of sentences) {
                if (sentence.length >= maxLength) {
                    // If single sentence is too long, split by maxLength
                    if (sentenceChunk) {
                        chunks.push(sentenceChunk.trim())
                        sentenceChunk = ''
                    }
                    for (let i = 0; i < sentence.length; i += maxLength) {
                        chunks.push(sentence.slice(i, Math.min(i + maxLength, sentence.length)).trim())
                    }
                } else if ((sentenceChunk + sentence).length >= maxLength) {
                    chunks.push(sentenceChunk.trim())
                    sentenceChunk = sentence
                } else {
                    sentenceChunk += sentence
                }
            }
            if (sentenceChunk) chunks.push(sentenceChunk.trim())
            continue
        }

        // Case 2: Normal paragraph handling
        if ((currentChunk + paragraph).length >= maxLength) {
            chunks.push(currentChunk.trim())
            currentChunk = paragraph + '\n\n'
        } else {
            currentChunk += paragraph + '\n\n'
        }
    }

    // Push final chunk if exists
    if (currentChunk) {
        chunks.push(currentChunk.trim())
    }

    return chunks.filter(chunk => chunk)
}

export const annotateFullArticle = inngest.createFunction(
    { id: 'annotate-article' },
    { event: 'app/article.imported' },
    async ({ step, event }) => {
        const { data: { article, textId, onlyComments, userId, generateTitle } } = event

        await step.run('set-annotation-progress-annotating', async () => {
            await setTextAnnotationProgress({ id: textId, progress: 'annotating' })
        })

        const { libId, lang } = await step.run('get-lib-id', async () => {
            return await getLibIdAndLangOfText({ id: textId })
        })

        const chunks = await step.run('chunk-text', async () => {
            return chunkText(article, getLanguageStrategy(lang).maxChunkSize)
        })

        const { topicsConfig, emojiConfig, titleConfig, annotationConfigs } = await step.run('get-annotate-configs', async () => {
            const topicsConfig = topicsPrompt(article)
            const emojiConfig = emojiPrompt(article)
            const titleConfig = generateTitle ? titlePrompt(article) : undefined
            const annotationConfigs = await Promise.all(chunks.map(chunk => articleAnnotationPrompt(lang, chunk, onlyComments, userId)))
            return { topicsConfig, emojiConfig, titleConfig, annotationConfigs }
        })

        const parallelTasks: Promise<unknown>[] = [
            step.ai.wrap('annotate-topics', generateText, topicsConfig),
            step.ai.wrap('generate-emoji', generateText, emojiConfig),
            ...annotationConfigs.map(async (config, index) => step.ai.wrap(`annotate-article-${index}`, generateText, config))
        ]
        if (titleConfig) {
            parallelTasks.push(step.ai.wrap('generate-title', generateText, titleConfig))
        }

        const results = await Promise.all(parallelTasks)
        const topics = results[0] as Awaited<ReturnType<typeof generateText>>
        const emoji = results[1] as Awaited<ReturnType<typeof generateText>>
        const annotatedChunks = results.slice(2, 2 + annotationConfigs.length) as Awaited<ReturnType<typeof generateText>>[]
        const titleResult = titleConfig ? results[2 + annotationConfigs.length] as Awaited<ReturnType<typeof generateText>> : undefined

        const content = annotatedChunks.map(chunk => chunk.steps[0].content[0].type === 'text' ? chunk.steps[0].content[0].text : '').join('\n\n')

        const textUrl = `/library/${libId}/${textId}`

        await step.run('set-annotation-progress-saving', async () => {
            await setTextAnnotationProgress({ id: textId, progress: 'saving' })
        })
        await step.run('save-article', async () => {
            const generatedEmoji = emoji.steps[0].content[0].type === 'text' ? emoji.steps[0].content[0].text.trim() : undefined
            const generatedTitle = titleResult?.steps[0].content[0].type === 'text' ? titleResult.steps[0].content[0].text.trim().replace(/^["'""''《》]+|["'""''《》]+$/g, '') : undefined
            await updateText({
                id: textId,
                content: fixDumbPunctuation(content),
                topics: topics.steps[0].content[0].type === 'text' ? topics.steps[0].content[0].text.split('||') : [],
                emoji: generatedEmoji,
                title: generatedTitle
            })
            revalidateTag(`texts:${libId}`, 'max')
        })

        await step.run('set-annotation-progress-completed', async () => {
            await setTextAnnotationProgress({ id: textId, progress: 'completed' })
        })
        const { hasSubs, subscription } = await step.run('get-user-subs', async () => {
            return await getSubsStatus({ userId })
        })

        if (hasSubs && subscription) {
            await step.sendEvent('notify-user-on-article-imported', {
                name: 'app/notify',
                data: {
                    title: 'Leximory',
                    body: '😎 导入文章注解完毕啦！',
                    url: prefixUrl(textUrl),
                    subscription
                },
                user: { uid: userId }
            })
        }
    }
)
