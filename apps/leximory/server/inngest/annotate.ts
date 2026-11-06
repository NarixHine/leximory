import { isUserActive } from '@repo/supabase/user'
import { emojiPrompt } from '../ai/text-metadata'
import { inngest } from './client'
import { prefixUrl } from '@repo/env/config'
import { getLanguageStrategy } from '@/lib/languages'
import { getLibIdAndLangOfText, setTextAnnotationProgress, updateText } from '../db/text'
import { getSubsStatus } from '../db/subs'
import { articleAnnotationPrompt } from '../ai/annotate'
import { nanoAI } from '../ai/config'
import { generateText } from 'ai'
import { revalidateTag } from 'next/cache'
import { fixDumbPunctuation } from '@repo/utils'
import { articleImported, notifyEvent } from './events'

import { topicsPrompt, titlePrompt, chunkText, getFinalAiOutput } from '../articles/annotation'

export const annotateFullArticle = inngest.createFunction(
    { id: 'annotate-article', triggers: [articleImported] },
    async ({ step, event }) => {
        const { article, textId, onlyComments, userId, generateTitle } = event.data

        if (!(await isUserActive(userId))) return { deleted: true }

        await step.run('set-annotation-progress-annotating', async () => {
            await setTextAnnotationProgress({ id: textId, progress: 'annotating' })
        })

        const { libId, lang } = await step.run('get-lib-id', async () => {
            return await getLibIdAndLangOfText({ id: textId })
        })

        const chunks = await step.run('chunk-text', async () => {
            return chunkText(article, getLanguageStrategy(lang).maxChunkSize)
        })

        const { topicsConfig, emojiConfig, titleConfig, annotationConfigs } = await step.run(
            'get-annotate-configs',
            async () => {
                const metadataAI = nanoAI
                const topicsConfig = { ...topicsPrompt(article), ...metadataAI }
                const emojiConfig = { ...emojiPrompt(article), ...metadataAI }
                const titleConfig = generateTitle ? { ...titlePrompt(article), ...metadataAI } : undefined
                const annotationConfigs = await Promise.all(
                    chunks.map(async (chunk) => {
                        const config = await articleAnnotationPrompt(lang, chunk, onlyComments, userId, true)
                        return config
                    }),
                )
                return { topicsConfig, emojiConfig, titleConfig, annotationConfigs }
            },
        )

        const parallelTasks: Promise<unknown>[] = [
            step.ai.wrap('annotate-topics', generateText, topicsConfig),
            step.ai.wrap('generate-emoji', generateText, emojiConfig),
            ...annotationConfigs.map(async (config, index) =>
                step.ai.wrap(`annotate-article-${index}`, generateText, config),
            ),
        ]
        if (titleConfig) {
            parallelTasks.push(step.ai.wrap('generate-title', generateText, titleConfig))
        }

        const results = await Promise.all(parallelTasks)
        const topics = results[0] as Awaited<ReturnType<typeof generateText>>
        const emoji = results[1] as Awaited<ReturnType<typeof generateText>>
        const annotatedChunks = results.slice(2, 2 + annotationConfigs.length) as Awaited<
            ReturnType<typeof generateText>
        >[]
        const titleResult = titleConfig
            ? (results[2 + annotationConfigs.length] as Awaited<ReturnType<typeof generateText>>)
            : undefined

        const content = annotatedChunks.map(getFinalAiOutput).join('\n\n')

        const textUrl = `/library/${libId}/${textId}`

        if (!(await isUserActive(userId))) return { deleted: true }
        await step.run('set-annotation-progress-saving', async () => {
            await setTextAnnotationProgress({ id: textId, progress: 'saving' })
        })
        await step.run('save-article', async () => {
            if (!(await isUserActive(userId))) return
            const generatedEmoji = getFinalAiOutput(emoji).trim() || undefined
            const generatedTitle = titleResult
                ? getFinalAiOutput(titleResult)
                      .trim()
                      .replace(/^["'""''《》]+|["'""''《》]+$/g, '')
                : undefined
            await updateText({
                id: textId,
                content: fixDumbPunctuation(content),
                topics: getFinalAiOutput(topics).split('||'),
                emoji: generatedEmoji,
                title: generatedTitle,
            })
            revalidateTag(`texts:${libId}`, 'max')
        })

        if (!(await isUserActive(userId))) return { deleted: true }
        await step.run('set-annotation-progress-completed', async () => {
            await setTextAnnotationProgress({ id: textId, progress: 'completed' })
        })
        if (!(await isUserActive(userId))) return { deleted: true }
        const { hasSubs, subscription } = await step.run('get-user-subs', async () => {
            return await getSubsStatus({ userId })
        })

        if (hasSubs && subscription) {
            await step.sendEvent(
                'notify-user-on-article-imported',
                notifyEvent.create({
                    title: 'Leximory',
                    body: '😎 导入文章注解完毕啦！',
                    url: prefixUrl(textUrl),
                    subscription,
                    uid: userId,
                }),
            )
        }
    },
)
