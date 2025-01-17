import { generateText } from 'ai'
import { inngest } from './client'
import { openai } from '@ai-sdk/openai'
import { Lang, prefixUrl } from '@/lib/config'
import { setTextAnnotationProgress, updateText } from '../db/text'
import { getSubsStatus } from '../db/subs'
import { instruction, accentPreferencePrompt } from '@/lib/prompt'

const articleAnnotationPrompt = async (lang: Lang, input: string, onlyComments: boolean, userId: string) => ({
    model: openai('gpt-4o-mini'),
    system: `
            生成文本注解（形如 [[vocabulary]] 双重中括号内的词必须注解，除此以外***尽可能多***地挑选。

            ${instruction[lang]}
            
            你将会看到一段网页文本，你${onlyComments ? '可以无视示例格式。禁止输出文本，直接制作词摘。你必须直接给出以{{}}包裹的注释部分，不加上下文。只输出{{}}内的内容（含{{}}，禁止省略双重大括号），输出形如“{{一个词汇的原形||原形||注解||……}} {{另一个词汇的原形||原形||注解||……}} ……”。不要注解术语，多多注解实用、通用语块，俗语、短语和动词搭配' : '首先要删去首尾的标题、作者、日期、导航和插入正文的广告等无关部分以及图片的来源和说明，段与段间空两行，并提取出其中的正文（含图片）。'}
    `,
    prompt: `
    ${lang !== 'en' ? '' : '你要为英语学习者注解一切高阶或罕见词汇，必须添加语源。'}注解必须均匀地遍布下文。
    ${onlyComments ? '注意：禁止输出原文。请多注解有益于语言学习的语块而非术语，尽可能详尽丰富，不得少于二十个。多注解成块词组、短语（例如on the horns of a dilemma）、俗语（catch off guard），尤其是动词短语，越多越好。' : ''}
    ${await accentPreferencePrompt({ lang, userId })}
    
    ${input}`,
    maxTokens: 3000
})

const topicsPrompt = async (input: string) => ({
    model: openai('gpt-4o-mini'),
    system: `
    用1~3个中文标签表示下文的话题或关键词。每个关键词间用||分隔。
    `,
    prompt: `请从下文提取出1~3个中文标签表示下文的话题或关键词：
    
    ${input}`,
    maxTokens: 100
})

const chunkText = (text: string, maxLength: number = 5000): string[] => {
    const chunks: string[] = []
    let currentChunk = ''

    // Split by paragraphs (double newline)
    const paragraphs = text.split(/\n\s*\n/)

    for (const paragraph of paragraphs) {
        if ((currentChunk + paragraph).length > maxLength && currentChunk) {
            chunks.push(currentChunk.trim())
            currentChunk = ''
        }
        currentChunk += paragraph + '\n\n'
    }

    if (currentChunk) {
        chunks.push(currentChunk.trim())
    }

    return chunks
}

export const annotateFullArticle = inngest.createFunction(
    { id: 'annotate-article' },
    { event: 'app/article.imported' },
    async ({ step, event }) => {
        const { article, lang, textId, libId, onlyComments, userId } = event.data

        await step.run('set-annotation-progress-annotating', async () => {
            await setTextAnnotationProgress({ id: textId, progress: 'annotating' })
        })

        const chunks = chunkText(article)
        const annotatedChunks = await Promise.all(
            chunks.map(async (chunk) => {
                const annotationConfig = await articleAnnotationPrompt(lang, chunk, onlyComments, userId)
                const { text } = await step.ai.wrap('annotate-article', generateText, annotationConfig)
                return text
            })
        )
        const content = annotatedChunks.join('\n\n')

        await step.run('set-annotation-progress-annotating-topics', async () => {
            await setTextAnnotationProgress({ id: textId, progress: 'annotating-topics' })
        })
        const topicsConfig = await topicsPrompt(article)
        const { text: topics } = await step.ai.wrap('annotate-topics', generateText, topicsConfig)

        const textUrl = `/library/${libId}/${textId}`

        await step.run('set-annotation-progress-saving', async () => {
            await setTextAnnotationProgress({ id: textId, progress: 'saving' })
        })
        await step.run('save-article', async () => {
            await updateText({ id: textId, content, topics: topics.split('||') })
        })

        await step.run('set-annotation-progress-completed', async () => {
            await setTextAnnotationProgress({ id: textId, progress: 'completed' })
        })
        const { hasSubs, subscription } = await step.run('get-user-subs', async () => {
            return await getSubsStatus({ userId })
        })

        if (hasSubs) {
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
