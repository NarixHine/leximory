import { connection, NextRequest, NextResponse } from 'next/server'
import { getUserOrThrow } from '@repo/user'
import { redis } from '@repo/kv/redis'
import { getFlashback } from '@/server/db/flashback'
import { normalizeReviewConversation, normalizeReviewConversationPayload, normalizeReviewTranslations } from '@/lib/review'

type CachedReviewProgress = {
    stage: string
    story?: string | null
    translations?: unknown
    conversation?: unknown
}

export async function GET(req: NextRequest) {
    await connection()
    try {
        const { userId } = await getUserOrThrow()
        const { searchParams } = new URL(req.url)
        const date = searchParams.get('date')
        const lang = searchParams.get('lang')

        if (!date || !lang) {
            return NextResponse.json({ error: 'Missing date or lang' }, { status: 400 })
        }

        const progressKey = `review:${userId}:${date}:${lang}`

        // Check Redis first (fast path)
        const cached = await redis.get(progressKey) as CachedReviewProgress | null
        if (cached) {
            const normalized = normalizeReviewConversationPayload(cached.translations, cached.conversation)

            if (cached.stage === 'complete') {
                return NextResponse.json({
                    exists: true,
                    inProgress: false,
                    stage: cached.stage,
                    story: cached.story,
                    translations: normalized.translations,
                    conversation: normalized.conversation,
                })
            }

            return NextResponse.json({
                exists: false,
                inProgress: true,
                stage: cached.stage,
                story: cached.story,
                translations: normalized.translations,
                conversation: normalized.conversation,
            })
        }

        // Check database
        const existingFlashback = await getFlashback({ userId, date, lang })
        if (existingFlashback) {
            // Populate Redis for next time
            await redis.set(progressKey, {
                stage: 'complete',
                story: existingFlashback.story,
                translations: existingFlashback.translations,
                conversation: existingFlashback.conversation,
            })
            return NextResponse.json({
                exists: true,
                inProgress: false,
                stage: 'complete',
                story: existingFlashback.story,
                translations: existingFlashback.translations,
                conversation: normalizeReviewConversation(existingFlashback.conversation),
            })
        }

        return NextResponse.json({ exists: false, inProgress: false })
    } catch (error) {
        console.error('Error checking flashback:', error)
        return NextResponse.json({ error: 'Failed to check flashback' }, { status: 500 })
    }
}
