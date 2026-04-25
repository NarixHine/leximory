import { after, NextResponse } from 'next/server'
import { z } from '@repo/schema'
import { getUserOrThrow } from '@repo/user'
import { redis } from '@repo/kv/redis'
import { getFlashback, updateFlashbackTranslations } from '@/server/db/flashback'
import { evaluateReviewTranslation } from '@/server/ai/evaluate-review-translation'

export const maxDuration = 60

const submitTranslationSchema = z.object({
    date: z.string().min(1),
    lang: z.string().min(1),
    index: z.number().int().min(0),
    submission: z.string().trim().min(1).max(500),
})

function getReviewProgressKey(userId: string, date: string, lang: string) {
    return `review:${userId}:${date}:${lang}`
}

export async function POST(request: Request) {
    try {
        const { userId } = await getUserOrThrow()
        const parsed = submitTranslationSchema.safeParse(await request.json())

        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid translation payload' }, { status: 400 })
        }

        const { date, lang, index, submission } = parsed.data
        const flashback = await getFlashback({ userId, date, lang })

        if (!flashback) {
            return NextResponse.json({ error: 'Review data not found' }, { status: 404 })
        }

        const translation = flashback.translations[index]
        if (!translation) {
            return NextResponse.json({ error: 'Translation item not found' }, { status: 404 })
        }

        const now = new Date().toISOString()
        const nextTranslations = flashback.translations.map((item, itemIndex) => {
            if (itemIndex !== index) return item
            return {
                ...item,
                submission,
                status: 'pending' as const,
                feedback: null,
                submittedAt: now,
                evaluatedAt: null,
            }
        })

        await updateFlashbackTranslations({
            userId,
            date,
            lang,
            translations: nextTranslations,
        })

        const progressKey = getReviewProgressKey(userId, date, lang)
        await redis.set(progressKey, {
            stage: 'complete',
            story: flashback.story,
            translations: nextTranslations,
        })

        after(async () => {
            try {
                const feedback = await evaluateReviewTranslation({
                    chinese: translation.chinese,
                    answer: translation.answer,
                    keyword: translation.keyword,
                    submission,
                })

                const latestFlashback = await getFlashback({ userId, date, lang })
                const latestTranslation = latestFlashback?.translations[index]
                if (!latestFlashback || !latestTranslation || latestTranslation.submission !== submission) {
                    return
                }

                const completedTranslations = latestFlashback.translations.map((item, itemIndex) => {
                    if (itemIndex !== index) return item
                    return {
                        ...item,
                        status: 'complete' as const,
                        feedback,
                        evaluatedAt: new Date().toISOString(),
                    }
                })

                await updateFlashbackTranslations({
                    userId,
                    date,
                    lang,
                    translations: completedTranslations,
                })

                await redis.set(progressKey, {
                    stage: 'complete',
                    story: latestFlashback.story,
                    translations: completedTranslations,
                })
            } catch (error) {
                console.error('Failed to evaluate review translation:', error)

                const latestFlashback = await getFlashback({ userId, date, lang })
                const latestTranslation = latestFlashback?.translations[index]
                if (!latestFlashback || !latestTranslation || latestTranslation.submission !== submission) {
                    return
                }

                const failedTranslations = latestFlashback.translations.map((item, itemIndex) => {
                    if (itemIndex !== index) return item
                    return {
                        ...item,
                        status: 'failed' as const,
                        feedback: null,
                        evaluatedAt: new Date().toISOString(),
                    }
                })

                await updateFlashbackTranslations({
                    userId,
                    date,
                    lang,
                    translations: failedTranslations,
                })

                await redis.set(progressKey, {
                    stage: 'complete',
                    story: latestFlashback.story,
                    translations: failedTranslations,
                })
            }
        })

        return NextResponse.json({
            success: true,
            translation: nextTranslations[index],
        })
    } catch (error) {
        console.error('Failed to submit review translation:', error)
        return NextResponse.json({ error: 'Failed to submit translation' }, { status: 500 })
    }
}
