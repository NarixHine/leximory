'use server'

import { Kilpi } from '@repo/service/kilpi'
import { generateObject, smoothStream, streamText } from 'ai'
import { ACTION_QUOTA_COST, Lang, MAX_FILE_SIZE } from '@repo/env/config'
import { createText, getTextAnnotationProgress, getTextContent, getTextWithLib, setTextAnnotationProgress, updateText, deleteText, uploadEbook } from '@/server/db/text'
import { inngest } from '@/server/inngest/client'
import { instruction } from '@/lib/prompt'
import { AnnotationProgress } from '@/lib/types'
import { z } from '@repo/schema'
import { getAnnotationCache, setAnnotationCache } from '@/server/db/ai-cache'
import crypto from 'crypto'
import { getUserOrThrow } from '@repo/user'
import { getLanguageStrategy } from '@/lib/languages'
import getLanguageServerStrategy from '@/lib/languages/strategies.server'
import { isValidEmoji } from '@/lib/utils'
import { updateTag } from 'next/cache'
import { visitText, getVisitedTextIds } from '@/server/db/visited'
import { miniAI, nanoAI } from '@/server/ai/configs'
import { getLib } from '@/server/db/lib'
import incrCommentaryQuota, { maxCommentaryQuota } from '@repo/user/quota'
import { redirect } from 'next/navigation'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Text actions
// ---------------------------------------------------------------------------

/** Marks a text as visited by the current user. */
export async function markAsVisited(textId: string) {
    const { userId } = await getUserOrThrow()
    const text = await getTextWithLib(textId)
    await Kilpi.texts.read(text).authorize().assert()
    await visitText({ textId, userId })
    const { lib } = await getTextContent({ id: textId })
    updateTag(`reads:${lib.id}`)
}

/** Extracts foreign-language words from an uploaded file via AI. */
export async function extractWords(form: FormData) {
    const { userId } = await getUserOrThrow()
    const file = form.get('file') as File

    if (await incrCommentaryQuota(ACTION_QUOTA_COST.wordList, userId)) {
        throw new Error('Quota exceeded')
    }

    const { object } = await generateObject({
        messages: [{
            role: 'system',
            content: '你会看到一些外语词汇和一些相关信息，只保留这些外语词汇并去除其他一切信息（中文也去除）。以字符串数组形式输出。',
        }, {
            role: 'user',
            content: [{
                type: 'file',
                data: await file.arrayBuffer(),
                mediaType: file.type
            }]
        }],
        schema: z.array(z.string()).describe('提取出的字符串数组形式的外语词汇'),
        maxOutputTokens: 8000,
        ...nanoAI
    })

    return object
}

/** Generates a story from vocabulary comments via Inngest. */
export async function generateStory({ comments, textId, storyStyle }: { comments: string[], textId: string, storyStyle?: string }) {
    const { userId } = await getUserOrThrow()
    const text = await getTextWithLib(textId)
    await Kilpi.texts.write(text).authorize().assert()

    if (await incrCommentaryQuota(ACTION_QUOTA_COST.story, userId)) {
        return {
            success: false,
            message: `本月 ${await maxCommentaryQuota()} 词点额度耗尽。`
        }
    }

    await inngest.send({
        name: 'app/story.requested',
        data: { comments, userId, storyStyle, textId }
    })

    return { success: true, message: '生成中……' }
}

/** Returns the latest content and topics of a text. */
export async function getNewText(id: string) {
    const { content, topics, emoji } = await getTextContent({ id })
    return { content, topics, emoji }
}

/** Saves partial updates (content, topics, title, emoji) to a text. */
export async function saveText({ id, ...updateData }: { id: string } & Partial<{ content: string; topics: string[]; title: string; emoji: string }>) {
    if (updateData.emoji !== undefined && updateData.emoji !== null && updateData.emoji !== '' && !isValidEmoji(updateData.emoji)) {
        throw new Error('Invalid emoji: must be a single emoji character')
    }
    const text = await getTextWithLib(id)
    await Kilpi.texts.write(text).authorize().assert()
    await updateText({ id, ...updateData })
    updateTag(`texts:${text.lib.id}`)
}

/** Deletes a text after verifying write access. */
export async function removeText({ id }: { id: string }) {
    const text = await getTextWithLib(id)
    await Kilpi.texts.write(text).authorize().assert()
    await deleteText({ id })
}

/** Uploads an EPUB ebook and attaches it to a text. */
export async function saveEbook(id: string, form: FormData) {
    const ebook = form.get('ebook') as File
    if (!['application/epub+zip'].includes(ebook.type)) {
        throw new Error('Not an epub file')
    }
    if (ebook.size > MAX_FILE_SIZE) {
        throw new Error('File too large')
    }
    const text = await getTextWithLib(id)
    await Kilpi.texts.write(text).authorize().assert()

    const url = await uploadEbook({ id, ebook })
    return url
}

/** Triggers article annotation via Inngest after checking quota. */
export async function generate({ article, textId, onlyComments, delayRevalidate }: { article: string, textId: string, onlyComments: boolean, delayRevalidate?: boolean }) {
    const { userId } = await getUserOrThrow()
    const text = await getTextWithLib(textId)
    await Kilpi.texts.write(text).authorize().assert()
    if (!text.lib) throw new Error('Text has no associated library')
    const lib = await getLib({ id: text.lib.id })
    const lang = lib.lang as Lang

    const length = article.length
    const { maxArticleLength } = getLanguageStrategy(lang)
    if (length > maxArticleLength) {
        throw new Error('Text too long')
    }
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.articleAnnotation, userId, delayRevalidate)) {
        return { error: `本月 ${await maxCommentaryQuota()} 词点额度耗尽。` }
    }

    await inngest.send({
        name: 'app/article.imported',
        data: { article, userId, textId, onlyComments }
    })
}

/** Generates a single vocabulary comment, using cache when available. */
export async function generateSingleComment({ prompt, lang }: { prompt: string, lang: Lang }) {
    const { userId } = await getUserOrThrow()
    const hash = crypto.createHash('sha256').update(prompt).digest('hex')
    const cache = await getAnnotationCache({ hash })
    if (cache) {
        return { text: cache }
    }

    const { maxArticleLength, exampleSentencePrompt } = getLanguageStrategy(lang)
    const { getAccentPrompt } = getLanguageServerStrategy(lang)
    if (prompt.length > maxArticleLength) {
        throw new Error('Text too long')
    }
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.wordAnnotation)) {
        return { error: `本月 ${await maxCommentaryQuota()} 词点额度耗尽。` }
    }

    const { textStream } = streamText({
        system: `
            生成词汇注解（形如<must>vocabulary</must>或[[vocabulary]]的、<must></must>或[[]]中的部分必须注解）。
            ${instruction[lang]}
            `,
        prompt: `下文中仅一个加<must>或双重中括号的语块，你仅需要对它**完整**注解${lang === 'en' ? '（例如如果括号内为"wrap my head around"，则对"wrap one\'s head around"进行注解；如果是"dip suddenly down"，则对"dip down"进行注解）' : (lang === 'zh' ? '（例如对于"天子[[并命]]"，注释"并命"在古汉语中而非现代汉语中的意思）' : '')}。如果是长句而非词汇则必须完整翻译并解释。不要在最后加多余的||。请依次输出它的原文形式、屈折变化的原形、语境义（含例句）${lang === 'en' ? '、语源、同源词' : ''}${lang === 'ja' ? '、语源（可选）' : ''}即可，但${exampleSentencePrompt}${await getAccentPrompt(userId)}。截断并删去词汇的前后文。\n\n${prompt}`,
        maxOutputTokens: 500,
        onFinish: async ({ text }) => {
            await setAnnotationCache({ hash, cache: text })
        },
        experimental_transform: lang === 'zh' || lang === 'ja' ? smoothStream({ chunking: lang === 'zh' ? /[\u4E00-\u9FFF]|\S+\s+/ : /[\u3040-\u309F\u30A0-\u30FF]|\S+\s+/ }) : (lang === 'en' ? smoothStream() : undefined),
        ...miniAI
    })

    return { text: textStream }
}

/** Returns the current annotation progress for a text. */
export async function getAnnotationProgressAction(id: string) {
    const text = await getTextWithLib(id)
    await Kilpi.texts.read(text).authorize().assert()
    const annotationProgress = await getTextAnnotationProgress({ id })
    return annotationProgress
}

/** Updates the annotation progress for a text. */
export async function setAnnotationProgressAction({ id, progress }: { id: string, progress: AnnotationProgress }) {
    const text = await getTextWithLib(id)
    await Kilpi.texts.write(text).authorize().assert()
    await setTextAnnotationProgress({ id, progress })
}

// ---------------------------------------------------------------------------
// Text creation (from library/[lib]/components/text/actions.ts)
// ---------------------------------------------------------------------------

/** Creates a new text in a library and redirects to it. */
export async function addText({ title, lib }: { title: string, lib: string }) {
    const libData = await getLib({ id: lib })
    await Kilpi.libraries.write(libData).authorize().assert()
    const id = await createText({ lib, title })
    updateTag(`texts:${lib}`)
    redirect(`/library/${lib}/${id}`)
}

/** Creates a text with content, generates annotations, and redirects. */
export async function addAndGenerateText({ title, content, lib }: { title: string, content: string, lib: string }) {
    const libData = await getLib({ id: lib })
    await Kilpi.libraries.write(libData).authorize().assert()
    const id = await createText({ lib, title, content })
    updateTag(`texts:${lib}`)
    await generate({ article: content, textId: id, onlyComments: false })
    await setTextAnnotationProgress({ id, progress: 'annotating' })
    redirect(`/library/${lib}/${id}`)
}

/** Returns IDs of texts visited by the current user in a library. */
export async function getVisitedTextsAction(libId: string) {
    const { userId } = await getUserOrThrow()
    return await getVisitedTextIds({ libId, userId })
}
