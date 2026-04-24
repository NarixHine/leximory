import { serve } from '@upstash/workflow/nextjs'
import { generateText } from 'ai'
import { getWordsWithin } from '@repo/supabase/word'
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

interface StoryWorkflowPayload {
    date: string
    lang: string
    userId: string
    storyStyle?: string
    progressKey: string
}

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
    const languageStrategy = getLanguageStrategy(lang as Lang)

    // Step 1: Get words once and check quotas up-front (fail fast for story)
    const { comments, words, translationQuotaExceeded } = await context.run('get-words-and-check-quotas', async () => {
        if (await incrCommentaryQuota(ACTION_QUOTA_COST.story, userId, true)) {
            throw new Error('Daily quota exceeded')
        }

        const targetDate = new Date(date)
        const today = new Date()
        const daysDiff = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24))

        const words = await getWordsWithin({
            fromDayAgo: daysDiff,
            toDayAgo: daysDiff - 1,
            userId,
        })

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

    // Step 2: Generate story and translations in parallel — they only depend on words.
    const storyPromise = context.run('generate-story', async () => {
        const config = await buildStoryConfig(comments, lang as Lang, userId, storyStyle)
        const { text } = await generateText(config)
        const { rawStory, title } = extractTitleAndStory(text)
        return { rawStory, title }
    })

    const translationsPromise = context.run('generate-translations', async () => {
        if (translationQuotaExceeded) {
            console.log('Translation quota exceeded, skipping translations')
            return []
        }

        const selectedWords = [...words].sort(() => 0.5 - Math.random()).slice(0, Math.min(5, words.length))

        const { text } = await generateText({
            system: `Create translation exercises for language learners. Return ONLY a JSON array, no markdown, no explanation.

For each vocabulary word:
1. Create a natural Chinese sentence that includes the word's meaning
2. Provide the correct English translation
3. Identify the key word being tested

Format: [{"chinese": "...", "answer": "...", "keyword": "..."}]`,
            prompt: `Create ${selectedWords.length} translation exercises for these words:
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

    const [{ rawStory, title }, translations] = await Promise.all([storyPromise, translationsPromise])

    // Step 3: Build annotation configs
    const annotationConfigs = await context.run('build-annotation-configs', async () => {
        const chunks = chunkText(rawStory, languageStrategy.maxChunkSize)
        return Promise.all(
            chunks.map((chunk, index) => articleAnnotationPrompt(lang as Lang, chunk, false, userId, true, index === 0))
        )
    })

    // Step 4: Annotate chunks in parallel (each AI call is its own durable step)
    const annotatedChunks = await Promise.all(
        annotationConfigs.map((config, index) =>
            context.run(`annotate-chunk-${index}`, async () => {
                const { text } = await generateText(config)
                return text
            })
        )
    )

    // Step 5: Combine annotations and push the story to the client
    const annotatedStory = await context.run('combine-annotations', async () => {
        const content = annotatedChunks.join('\n\n')
        return fixDumbPunctuation(content)
    })

    await context.run('update-progress-story', async () => {
        await redis.set(progressKey, {
            stage: 'translations',
            story: annotatedStory,
            translations: null,
        })
    })

    // Step 6: Save final result with translations
    await context.run('save-flashback', async () => {
        const fullStory = `## ${title}\n\n${annotatedStory}`

        await redis.set(progressKey, {
            stage: 'complete',
            story: fullStory,
            translations,
        })

        await createFlashback({
            userId,
            date,
            lang,
            story: fullStory,
            translations,
        })
    })
    console.log('Saved flashback and updated progress for workflow')
})
