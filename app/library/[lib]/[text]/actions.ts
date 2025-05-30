'use server'

import { authReadToText, authWriteToText, getAuthOrThrow } from '@/server/auth/role'
import { generateObject, generateText, smoothStream, streamText } from 'ai'
import { createStreamableValue } from 'ai/rsc'
import { authReadToLib, authWriteToLib } from '@/server/auth/role'
import incrCommentaryQuota from '@/server/auth/quota'
import { maxCommentaryQuota } from '@/server/auth/quota'
import { getBestCommentaryModel, googleModels, Lang, maxArticleLength, MAX_FILE_SIZE } from '@/lib/config'
import { deleteText, getTextAnnotationProgress, getTextContent, setTextAnnotationProgress, updateText, uploadEbook } from '@/server/db/text'
import { inngest } from '@/server/inngest/client'
import { instruction, exampleSentencePrompt, accentPreferencePrompt } from '@/lib/prompt'
import { AnnotationProgress } from '@/lib/types'
import { z } from 'zod'
import { getAnnotationCache, setAnnotationCache } from '@/server/db/ai-cache'
import crypto from 'crypto'

export async function extractWords(form: FormData) {
    const { userId } = await getAuthOrThrow()
    const file = form.get('file') as File

    if (await incrCommentaryQuota(1, userId)) {
        throw new Error('Quota exceeded')
    }

    const { object } = await generateObject({
        model: googleModels['flash-2.0'],
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: '你会看到一些外语词汇和一些相关信息，只保留这些外语词汇并去除其他一切信息（中文也去除）。以字符串数组形式输出。',
                    },
                    {
                        type: 'file',
                        data: await file.arrayBuffer(),
                        mimeType: file.type,
                    },
                ],
            },
        ],
        schema: z.array(z.string()).describe('提取出的字符串数组形式的外语词汇'),
        maxTokens: 8000
    })

    return object
}

export async function generateStory({ comments, textId, storyStyle }: { comments: string[], textId: string, storyStyle?: string }) {
    const { userId } = await getAuthOrThrow()
    await authWriteToText(textId)

    if (await incrCommentaryQuota(2)) {
        return {
            success: false,
            message: `本月 ${await maxCommentaryQuota()} 次 AI 注释生成额度耗尽。`
        }
    }

    await inngest.send({
        name: 'app/story.requested',
        data: {
            comments,
            userId,
            storyStyle,
            textId
        }
    })

    return {
        success: true,
        message: '生成中……'
    }
}

export async function getNewText(id: string) {
    const { content, topics } = await getTextContent({ id })
    return { content, topics }
}

export async function save({ id, ...updateData }: { id: string } & Partial<{ content: string; topics: string[]; title: string }>) {
    await authWriteToText(id)
    await updateText({ id, ...updateData })
}

export async function remove({ id }: { id: string }) {
    await authWriteToText(id)
    await deleteText({ id })
}

export async function saveEbook(id: string, form: FormData) {
    const ebook = form.get('ebook') as File
    if (ebook.type !== 'application/epub+zip') {
        throw new Error('Not an epub file')
    }
    if (ebook.size > MAX_FILE_SIZE) {
        throw new Error('File too large')
    }
    await authWriteToText(id)

    const url = await uploadEbook({ id, ebook })
    return url
}

export async function generate({ article, textId, onlyComments }: { article: string, textId: string, onlyComments: boolean }) {
    const { userId } = await getAuthOrThrow()
    const { lib } = await authWriteToText(textId)
    const libId = lib!.id
    const { lang } = await authWriteToLib(libId)

    const length = article.length
    if (length > maxArticleLength(lang)) {
        throw new Error('Text too long')
    }
    if (await incrCommentaryQuota(Math.ceil(length / 8000))) {
        return { error: `本月 ${await maxCommentaryQuota()} 次 AI 注释生成额度耗尽。` }
    }

    await inngest.send({
        name: 'app/article.imported',
        data: {
            article,
            userId,
            textId,
            onlyComments
        }
    })
}

export async function generateSingleComment(prompt: string, lib: string) {
    const stream = createStreamableValue()
    const { userId } = await getAuthOrThrow()
    const hash = crypto.createHash('sha256').update(prompt).digest('hex')
    const cache = await getAnnotationCache({ hash })
    if (cache) {
        stream.update(cache)
        stream.done()
        return { text: stream.value }
    }

    const { lang } = await authReadToLib(lib)

    if (prompt.length > maxArticleLength(lang)) {
        throw new Error('Text too long')
    }
    if (await incrCommentaryQuota(0.25)) {
        return { error: `本月 ${await maxCommentaryQuota()} 次 AI 注释生成额度耗尽。` }
    }

    (async () => {
        const { textStream } = streamText({
            model: getBestCommentaryModel(lang),
            system: `
            生成词汇注解（形如<must>vocabulary</must>或[[vocabulary]]的、<must></must>或[[]]中的部分必须注解）。
            ${instruction[lang]}
            `,
            prompt: `下文中仅一个加<must>或双重中括号的语块，你仅需要对它**完整**注解${lang === 'en' ? '（例如如果括号内为“wrap my head around”，则对“wrap one\'s head around”进行注解；如果是“dip suddenly down"，则对“dip down”进行注解）' : (lang === 'zh' ? '（例如对于“天子[[并命]]”，注释“并命”在古汉语中而非现代汉语中的意思）' : '')}。如果是长句而非词汇则必须完整翻译并解释。不要在最后加多余的||。请依次输出它的原文形式、屈折变化的原形、语境义（含例句）${lang === 'en' ? '、语源、同源词' : ''}${lang === 'ja' ? '、语源（可选）' : ''}即可，但${exampleSentencePrompt(lang)}${await accentPreferencePrompt({ lang, userId })}。截断并删去词汇的前后文。\n\n${prompt}`,
            maxTokens: 500,
            onFinish: async ({ text }) => {
                await setAnnotationCache({ hash, cache: text })
            },
            providerOptions: {
                google: {
                    thinkingConfig: {
                        thinkingBudget: 0,
                    },
                }
            },
            experimental_transform: lang === 'zh' || lang === 'ja' ? smoothStream({ chunking: lang === 'zh' ? /[\u4E00-\u9FFF]|\S+\s+/ : /[\u3040-\u309F\u30A0-\u30FF]|\S+\s+/ }) : (lang === 'en' ? smoothStream() : undefined)
        })

        for await (const delta of textStream) {
            stream.update(delta)
        }
        stream.done()
    })()

    return { text: stream.value }
}

export async function generateSingleCommentFromShortcut(prompt: string, lang: Lang, userId: string) {
    if (await incrCommentaryQuota(0.25, userId)) {
        return { error: `本月 ${await maxCommentaryQuota()} 次 AI 注释生成额度耗尽。` }
    }

    const { text } = await generateText({
        model: getBestCommentaryModel(lang),
        system: `
        生成词汇注解（形如<must>vocabulary</must>、<must></must>中的部分必须注解）。

        ${instruction[lang]}
        `,
        prompt: `下面是一个加<must>的语块，你仅需要对它**完整**注解${lang === 'en' ? '（例如如果括号内为“wrap my head around”，则对“wrap one\'s head around”进行注解；如果是“dip suddenly down"，则对“dip down”进行注解）' : ''}。如果是长句则完整翻译并解释。不要在输出中附带下文。请依次输出它的原文形式、原形、语境义（含例句）${lang === 'en' ? '、语源、同源词' : ''}${lang === 'ja' ? '、语源（可选）' : ''}即可，但${exampleSentencePrompt(lang)}${await accentPreferencePrompt({ lang, userId })}\n你要注解的是：\n${prompt}`,
        maxTokens: 500,
        providerOptions: {
            google: {
                thinkingConfig: {
                    thinkingBudget: 0,
                },
            }
        }
    })

    return text
}

export async function getAnnotationProgress(id: string) {
    await authReadToText(id)
    const annotationProgress = await getTextAnnotationProgress({ id })
    return annotationProgress
}

export async function setAnnotationProgress({ id, progress }: { id: string, progress: AnnotationProgress }) {
    await authWriteToText(id)
    await setTextAnnotationProgress({ id, progress })
}
