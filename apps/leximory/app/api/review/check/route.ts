import { connection, NextRequest, NextResponse } from 'next/server'
import { getUserOrThrow } from '@repo/user'
import { redis } from '@repo/kv/redis'
import { getFlashback } from '@/server/db/flashback'
import { normalizeReviewTranslations } from '@/lib/review'

export async function GET(req: NextRequest) {
    try {
        await connection()
        const { userId } = await getUserOrThrow()
        const { searchParams } = new URL(req.url)
        const date = searchParams.get('date')
        const lang = searchParams.get('lang')

        if (!date || !lang) {
            return NextResponse.json({ error: 'Missing date or lang' }, { status: 400 })
        }

        const progressKey = `review:${userId}:${date}:${lang}`

        // Check Redis first (fast path)
        const cached = await redis.get(progressKey) as { stage: string; story?: string; translations?: any[] } | null
        if (cached && cached.stage === 'complete') {
            return NextResponse.json({
                exists: true,
                story: cached.story,
                translations: normalizeReviewTranslations(cached.translations),
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
            })
            return NextResponse.json({
                exists: true,
                story: existingFlashback.story,
                translations: existingFlashback.translations,
            })
        }

        return NextResponse.json({ exists: false })
    } catch (error) {
        console.error('Error checking flashback:', error)
        return NextResponse.json({ error: 'Failed to check flashback' }, { status: 500 })
    }
}
