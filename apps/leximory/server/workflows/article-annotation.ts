import 'server-only'
import type { WorkflowContext } from '@upstash/workflow'
import type { z } from 'zod'
import { generateText } from 'ai'
import { isUserActive } from '@repo/supabase/user'
import { fixDumbPunctuation } from '@repo/utils'
import { revalidateTag } from 'next/cache'
import { getLanguageStrategy } from '@/lib/languages'
import { articleAnnotationPrompt } from '../ai/annotate'
import { emojiPrompt } from '../ai/text-metadata'
import { chunkText, topicsPrompt, titlePrompt } from '../articles/annotation'
import { getLibIdAndLangOfText, setTextAnnotationProgress, updateText } from '../db/text'
import { mobileMiniAI, mobileNanoAI } from '../mobile/ai-config'
import { notifyArticleImported } from './notify'
import type { articleImportEventSchema } from './contracts'

export async function annotateArticle(context: WorkflowContext<z.infer<typeof articleImportEventSchema>>) {
    const { article, textId, userId, onlyComments, generateTitle } = context.requestPayload
    const library = await context.run('prepare-annotation', async () => {
        if (!(await isUserActive(userId))) return null
        await setTextAnnotationProgress({ id: textId, progress: 'annotating' })
        return getLibIdAndLangOfText({ id: textId })
    })
    if (!library) return
    const { libId, lang } = library
    const chunks = chunkText(article, getLanguageStrategy(lang).maxChunkSize)
    // Build AI configs inside their steps: model objects and credentials are never step output.
    const [topics, emoji, title, ...annotations] = await Promise.all([
        context.run('topics', async () => (await generateText({ ...topicsPrompt(article), ...mobileNanoAI })).text),
        context.run('emoji', async () => (await generateText({ ...emojiPrompt(article), ...mobileNanoAI })).text),
        context.run('title', async () =>
            generateTitle ? (await generateText({ ...titlePrompt(article), ...mobileNanoAI })).text : null,
        ),
        ...chunks.map((chunk, index) =>
            context.run(`annotation-${index}`, async () => {
                if (!(await isUserActive(userId))) return ''
                const config = await articleAnnotationPrompt(lang, chunk, onlyComments, userId, true)
                return (await generateText({ ...config, ...mobileMiniAI })).text
            }),
        ),
    ])
    await context.run('save-article', async () => {
        if (!(await isUserActive(userId))) return
        await setTextAnnotationProgress({ id: textId, progress: 'saving' })
        await updateText({
            id: textId,
            content: fixDumbPunctuation(annotations.join('\n\n')),
            topics: (topics ?? '').split('||'),
            emoji: emoji?.trim() || undefined,
            title: title?.trim().replace(/^["'“”‘’《》]+|["'“”‘’《》]+$/g, '') || undefined,
        })
        revalidateTag(`texts:${libId}`, 'max')
    })
    await context.run('complete-annotation', async () => {
        if (await isUserActive(userId)) await setTextAnnotationProgress({ id: textId, progress: 'completed' })
    })
    await context.run('notify-imported', () => notifyArticleImported(userId, `/library/${libId}/${textId}`))
}
