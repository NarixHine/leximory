import { generateText } from 'ai'
import { inngest } from './client'
import { prefixUrl } from '@/lib/config'
import { getLanguageStrategy } from '@/lib/languages'
import { getLibIdAndLangOfText, setTextAnnotationProgress, updateText } from '../db/text'
import { getSubsStatus } from '../db/subs'
import { noThinkingConfig } from '../ai/models'
import { getBestArticleAnnotationModel } from '../ai/models'
import { articleAnnotationPrompt } from '../ai/annotate'

const topicsPrompt = async (input: string) => ({
    system: `
    用1~3个中文标签表示下文的话题或关键词。每个关键词间用||分隔。
    `,
    prompt: `请从下文提取出1~3个中文标签表示下文的话题或关键词：
    
    ${input}`,
    maxTokens: 100,
    ...noThinkingConfig
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
        const { article, textId, onlyComments, userId } = event.data

        const { libId, lang } = await step.run('get-lib-id', async () => {
            return await getLibIdAndLangOfText({ id: textId })
        })

        await step.run('set-annotation-progress-annotating', async () => {
            await setTextAnnotationProgress({ id: textId, progress: 'annotating' })
        })

        const chunks = chunkText(article, getLanguageStrategy(lang).maxChunkSize)

        const { topicsConfig, annotationConfigs } = await step.run('get-annotate-configs', async () => {
            const topicsConfig = await topicsPrompt(article)
            const annotationConfigs = await Promise.all(chunks.map(chunk => articleAnnotationPrompt(lang, chunk, onlyComments, userId)))
            return { topicsConfig, annotationConfigs }
        })

        const [topics, ...annotatedChunks] = await Promise.all([
            step.ai.wrap('annotate-topics', generateText, { model: await getBestArticleAnnotationModel(lang), ...topicsConfig }),
            ...annotationConfigs.map(async (config, index) => step.ai.wrap(`annotate-article-${index}`, generateText, {
                model: getBestArticleAnnotationModel(lang), ...config
            }))
        ])

        const content = annotatedChunks.map(chunk => chunk.text).join('\n\n')

        const textUrl = `/library/${libId}/${textId}`

        await step.run('set-annotation-progress-saving', async () => {
            await setTextAnnotationProgress({ id: textId, progress: 'saving' })
        })
        await step.run('save-article', async () => {
            await updateText({ id: textId, content, topics: topics.text.split('||') })
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
