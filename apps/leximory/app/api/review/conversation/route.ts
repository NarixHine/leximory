import { after, NextResponse } from 'next/server'
import { Lang } from '@repo/env/config'
import { z } from '@repo/schema'
import { getUserOrThrow } from '@repo/user'
import { redis } from '@repo/kv/redis'
import { getFlashback, updateFlashbackReview } from '@/server/db/flashback'
import { evaluateReviewConversation } from '@/server/ai/evaluate-review-conversation'
import { getConversationUnlockProgress } from '@/lib/review'

const submitConversationSchema = z.object({
    date: z.string().min(1),
    lang: z.string().min(1),
    submission: z.string().trim().min(1).max(1200),
})

function getReviewProgressKey(userId: string, date: string, lang: string) {
    return `review:${userId}:${date}:${lang}`
}

export async function POST(request: Request) {
    try {
        const { userId } = await getUserOrThrow()
        const parsed = submitConversationSchema.safeParse(await request.json())

        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid conversation payload' }, { status: 400 })
        }

        const { date, lang, submission } = parsed.data
        const flashback = await getFlashback({ userId, date, lang })

        if (!flashback?.conversation) {
            return NextResponse.json({ error: 'Conversation task not found' }, { status: 404 })
        }

        const unlockProgress = getConversationUnlockProgress(flashback.translations)
        if (!unlockProgress.isUnlocked) {
            return NextResponse.json({ error: 'Conversation is still locked' }, { status: 403 })
        }

        const now = new Date().toISOString()
        const nextConversation = {
            ...flashback.conversation,
            submission,
            status: 'pending' as const,
            feedback: null,
            reply: null,
            submittedAt: now,
            evaluatedAt: null,
        }

        await updateFlashbackReview({
            userId,
            date,
            lang,
            translations: flashback.translations,
            conversation: nextConversation,
        })

        const progressKey = getReviewProgressKey(userId, date, lang)
        await redis.set(progressKey, {
            stage: 'complete',
            story: flashback.story,
            translations: flashback.translations,
            conversation: nextConversation,
        })

        after(async () => {
            try {
                const evaluation = await evaluateReviewConversation({
                    prompt: flashback.conversation!.prompt,
                    submission,
                    keywords: flashback.conversation!.keywords,
                    lang: lang as Lang,
                })

                const latestFlashback = await getFlashback({ userId, date, lang })
                if (!latestFlashback?.conversation || latestFlashback.conversation.submission !== submission) {
                    return
                }

                const completedConversation = {
                    ...latestFlashback.conversation,
                    status: 'complete' as const,
                    feedback: {
                        rationale: evaluation.rationale,
                        goodPairs: evaluation.goodPairs,
                        badPairs: evaluation.badPairs,
                    },
                    reply: evaluation.reply,
                    evaluatedAt: new Date().toISOString(),
                }

                await updateFlashbackReview({
                    userId,
                    date,
                    lang,
                    translations: latestFlashback.translations,
                    conversation: completedConversation,
                })

                await redis.set(progressKey, {
                    stage: 'complete',
                    story: latestFlashback.story,
                    translations: latestFlashback.translations,
                    conversation: completedConversation,
                })
            } catch (error) {
                console.error('Failed to evaluate review conversation:', error)

                const latestFlashback = await getFlashback({ userId, date, lang })
                if (!latestFlashback?.conversation || latestFlashback.conversation.submission !== submission) {
                    return
                }

                const failedConversation = {
                    ...latestFlashback.conversation,
                    status: 'failed' as const,
                    feedback: null,
                    reply: null,
                    evaluatedAt: new Date().toISOString(),
                }

                await updateFlashbackReview({
                    userId,
                    date,
                    lang,
                    translations: latestFlashback.translations,
                    conversation: failedConversation,
                })

                await redis.set(progressKey, {
                    stage: 'complete',
                    story: latestFlashback.story,
                    translations: latestFlashback.translations,
                    conversation: failedConversation,
                })
            }
        })

        return NextResponse.json({
            success: true,
            conversation: nextConversation,
        })
    } catch (error) {
        console.error('Failed to submit review conversation:', error)
        return NextResponse.json({ error: 'Failed to submit conversation' }, { status: 500 })
    }
}
