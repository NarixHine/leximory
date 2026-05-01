import { serve } from '@upstash/workflow/nextjs'
import { generateObject, generateText } from 'ai'
import { getWordsWithin } from '@repo/supabase/word'
import { z } from '@repo/schema'
import { getLanguageStrategy } from '@/lib/languages/strategies'
import { parseCommentParams } from '@/lib/comment'
import { miniAI } from '@/server/ai/configs'
import getLanguageServerStrategy from '@/lib/languages/strategies.server'
import { Lang } from '@repo/env/config'
import incrCommentaryQuota from '@repo/user/quota'
import { ACTION_QUOTA_COST } from '@repo/env/config'
import { articleAnnotationPrompt } from '@/server/ai/annotate'
import { fixDumbPunctuation } from '@repo/utils'
import { redis } from '@repo/kv/redis'
import { createFlashback } from '@/server/db/flashback'
import { getReviewLanguageCopy } from '@/lib/review-language'
import { LEXIMORY_WORLD_VIEW, type ReviewConversation } from '@/lib/review'

interface StoryWorkflowPayload {
    date: string
    lang: string
    userId: string
    storyStyle?: string
    progressKey: string
}

interface GeneratedConversation {
    prompt: string
    keywords: string[]
}

interface ReviewGenerationProgress {
    stage: 'story' | 'translations' | 'conversation' | 'complete'
    story: string | null
    translations: Array<{ prompt: string; answer: string; keyword: string }> | null
    conversation: ReviewConversation | null
}

type PendingReviewResult =
    | { kind: 'story'; value: string }
    | { kind: 'translations'; value: Array<{ prompt: string; answer: string; keyword: string }> }
    | { kind: 'conversation'; value: GeneratedConversation | null }

const buildStoryConfig = async (comments: string[], lang: Lang, userId: string, storyStyle?: string) => ({
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
        8. 故事必须按照以下风格与内容创作：${storyStyle || '无特定要求'}
        9. 请给故事起一个合适的标题，使用 markdown "##" 语法（如 ## 标题）
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

/**
 * Extracts the first markdown h2 title from the text and returns both the
 * cleaned title and the story body with the title line removed.
 *
 * Robust against:
 * - Missing titles (falls back to "Untitled Story")
 * - Multi-line titles (only the title line is removed)
 * - Other markdown headers like ### (ignored)
 * - Titles appearing anywhere in the text (first match wins)
 */
const extractTitleAndStory = (text: string): { title: string; rawStory: string } => {
    const lines = text.split('\n')
    const titleIndex = lines.findIndex(line => /^##[^#]/.test(line.trim()))

    if (titleIndex === -1) {
        return { title: 'Untitled Story', rawStory: text.trim() }
    }

    const title = lines[titleIndex].trim().replace(/^##\s*/, '').trim()
    const rawStory = [
        ...lines.slice(0, titleIndex),
        ...lines.slice(titleIndex + 1),
    ].join('\n').trim()

    return { title: title || 'Untitled Story', rawStory }
}

const chunkText = (text: string, maxLength: number): string[] => {
    if (!text) return []
    if (text.length <= maxLength) return [text]

    const chunks: string[] = []
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim())
    let currentChunk = ''

    for (const paragraph of paragraphs) {
        if (paragraph.length >= maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk.trim())
                currentChunk = ''
            }

            const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph]

            let sentenceChunk = ''
            for (const sentence of sentences) {
                if (sentence.length >= maxLength) {
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

        if ((currentChunk + paragraph).length >= maxLength) {
            chunks.push(currentChunk.trim())
            currentChunk = paragraph + '\n\n'
        } else {
            currentChunk += paragraph + '\n\n'
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk.trim())
    }

    return chunks.filter(chunk => chunk)
}

export const { POST } = serve<StoryWorkflowPayload>(async (context) => {
    const { date, lang, userId, storyStyle, progressKey } = context.requestPayload
    const reviewLang = lang as Lang
    const languageStrategy = getLanguageStrategy(reviewLang)
    const reviewCopy = getReviewLanguageCopy(reviewLang)

    // Step 1: Get words once and check quotas up-front (fail fast for story)
    const { comments, words, translationQuotaExceeded } = await context.run('get-words-and-check-quotas', async () => {
        if (await incrCommentaryQuota(ACTION_QUOTA_COST.story, userId, true)) {
            throw new Error('Daily quota exceeded')
        }

        const targetDate = new Date(date)
        const today = new Date()
        const daysDiff = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24))

        const allWords = await getWordsWithin({
            fromDayAgo: daysDiff,
            toDayAgo: daysDiff - 1,
            userId,
        })

        const words = allWords.filter((word) => word.lang === reviewLang)

        if (words.length === 0) {
            throw new Error('No words found for the specified date')
        }

        const translationQuotaExceeded = await incrCommentaryQuota(ACTION_QUOTA_COST.wordAnnotation, userId, true)

        return {
            comments: words.map(w => w.word),
            words,
            translationQuotaExceeded,
        }
    })

    const progress: ReviewGenerationProgress = {
        stage: 'story',
        story: null,
        translations: null,
        conversation: null,
    }

    let storyReady = false
    let translationsReady = false
    let conversationReady = false

    const getStage = (): ReviewGenerationProgress['stage'] => {
        if (!storyReady) return 'story'
        if (!translationsReady) return 'translations'
        if (!conversationReady) return 'conversation'
        return 'complete'
    }

    const updateProgress = async (patch: Partial<Omit<ReviewGenerationProgress, 'stage'>>) => {
        Object.assign(progress, patch)
        progress.stage = getStage()
        await redis.set(progressKey, progress)
    }

    // Step 2: Generate the three visible review items in parallel.
    const storyPromise = (async () => {
        const { rawStory, title } = await context.run('generate-story', async () => {
            const config = await buildStoryConfig(comments, reviewLang, userId, storyStyle)
            const { text } = await generateText(config)
            return extractTitleAndStory(text)
        })

        const annotationConfigs = await context.run('build-annotation-configs', async () => {
            const chunks = chunkText(rawStory, languageStrategy.maxChunkSize)
            return Promise.all(
                chunks.map((chunk, index) => articleAnnotationPrompt(reviewLang, chunk, false, userId, true, index === 0))
            )
        })

        const annotatedChunks = await Promise.all(
            annotationConfigs.map((config, index) =>
                context.run(`annotate-chunk-${index}`, async () => {
                    const { text } = await generateText(config)
                    return text
                })
            )
        )

        const annotatedStory = await context.run('combine-annotations', async () => {
            const content = annotatedChunks.join('\n\n')
            return fixDumbPunctuation(content)
        })

        return `## ${title}\n\n${annotatedStory}`
    })()

    const translationsPromise = context.run('generate-translations', async () => {
        if (translationQuotaExceeded) {
            console.log('Translation quota exceeded, skipping translations')
            return []
        }

        const selectedWords = [...words].sort(() => 0.5 - Math.random()).slice(0, Math.min(5, words.length))

        const { text } = await generateText({
            system: `Create translation exercises for learners of ${reviewCopy.targetLanguageName}. Return ONLY a JSON array, no markdown, no explanation.

For each vocabulary word:
1. Create a natural Chinese sentence that conveys the word's meaning clearly.
2. Provide the correct ${reviewCopy.targetLanguageName} translation of that sentence.
3. Ensure the ${reviewCopy.targetLanguageName} translation naturally includes the keyword or a grammatically correct inflected form of it.
4. Identify the key word being tested.

Format: [{"prompt": "...", "answer": "...", "keyword": "..."}]`,
            prompt: `Create ${selectedWords.length} translation exercises for these ${reviewCopy.targetLanguageName} vocabulary words:
${selectedWords.map((w, i) => {
                const parts = w.word.replace(/\{\{|\}\}/g, '').split('||')
                return `${i + 1}. ${parts[0]} - ${parts[2] || parts[1]}`
            }).join('\n')}`,
            maxOutputTokens: 2000,
            ...miniAI,
        })

        try {
            const match = text.match(/\[[\s\S]*\]/)
            if (match) {
                return JSON.parse(match[0])
            }
            return []
        } catch (error) {
            console.error('Error parsing translations:', error)
            return []
        }
    })

    const conversationPromise = context.run('generate-conversation', async (): Promise<GeneratedConversation | null> => {
        const selectedWords = [...words].sort(() => 0.5 - Math.random()).slice(0, Math.min(8, words.length))
        const selectedKeywords = selectedWords.map((word) => {
            const parts = word.word.replace(/\{\{|\}\}/g, '').split('||')
            return parts[1] || parts[0]
        }).filter(Boolean)

        const { object } = await generateObject({
            ...miniAI,
            schema: z.object({
                prompt: z.string(),
            }),
            prompt: `
${LEXIMORY_WORLD_VIEW}

你要为 Leximory 语言学习软件的每日练笔生成一个简明而有新意的写作情境，供用户回答小黑猫。

严格要求：
1. 输出内容必须使用用户正在学习词汇的目标语言：${reviewCopy.targetLanguageName}。
2. 叙述口吻必须是小黑猫，语气娴静、内敛、探问、温存。
3. 情境必须围绕这些关键词，尽量与尽可能多的关键词产生自然关联：${selectedKeywords.join(' / ')}；但是禁止刻意堆砌场景设定，并且请勿在你的情境描述本身中出现这些关键词！
4. 情境要贴近现实生活，可以涉及小白猫生活中的点滴思考、对自身生活方方面面的介绍，如家中的陈设、学校里的社团、参与的社会实践课题，或对社会热点和新闻事件的倡议或异议。
5. 构建设定必须基于一个类人类社会，但禁止脱离猫忆世界的大体世界观。
6. 鼓励用户选用新学习的关键词，但不要把要求写得像考试说明。语气、句式要自然，可以多样。
7. 成品要简明，像小黑猫轻声发来的一个练笔邀约，不要超过140个目标语言字符为宜。
8. 只生成练笔情境本身，不要添加标题、编号、解释或中文。
`,
        })

        return {
            prompt: object.prompt.trim(),
            keywords: selectedKeywords,
        }
    })

    const pending = new Map<string, Promise<PendingReviewResult>>([
        ['story', storyPromise.then((story) => ({ kind: 'story' as const, value: story }))],
        ['translations', translationsPromise.then((translations) => ({ kind: 'translations' as const, value: translations }))],
        ['conversation', conversationPromise.then((generatedConversation) => ({ kind: 'conversation' as const, value: generatedConversation }))],
    ])

    let fullStory = ''
    let translations: Array<{ prompt: string; answer: string; keyword: string }> = []
    let conversation: ReviewConversation | null = null

    while (pending.size > 0) {
        const settled = await Promise.race(pending.values())
        pending.delete(settled.kind)

        if (settled.kind === 'story') {
            fullStory = settled.value
            storyReady = true

            await context.run('update-progress-story', async () => {
                await updateProgress({ story: fullStory })
            })
            continue
        }

        if (settled.kind === 'translations') {
            translations = settled.value
            translationsReady = true

            await context.run('update-progress-translations', async () => {
                await updateProgress({ translations })
            })
            continue
        }

        conversation = settled.value
            ? {
                worldView: LEXIMORY_WORLD_VIEW,
                prompt: settled.value.prompt,
                keywords: settled.value.keywords,
                submission: null,
                status: 'idle',
                feedback: null,
                reply: null,
                submittedAt: null,
                evaluatedAt: null,
            }
            : null
        conversationReady = true

        await context.run('update-progress-conversation', async () => {
            await updateProgress({ conversation })
        })
    }

    // Step 3: Save final result once all items are ready.
    await context.run('save-flashback', async () => {
        await redis.set(progressKey, {
            stage: 'complete',
            story: fullStory,
            translations,
            conversation,
        })

        await createFlashback({
            userId,
            date,
            lang,
            story: fullStory,
            translations,
            conversation,
        })
    })
    console.log('Saved flashback and updated progress for workflow')
})
