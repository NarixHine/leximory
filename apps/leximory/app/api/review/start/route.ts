import { NextRequest, NextResponse } from 'next/server'
import { getUserOrThrow } from '@repo/user'
import { redis } from '@repo/kv/redis'
import { generateStory } from '../steps/generate-story'
import { getFlashback } from '@/server/db/flashback'

export async function POST(req: NextRequest) {
    try {
        const { userId } = await getUserOrThrow()
        const { date, lang } = await req.json()

        if (!date || !lang) {
            return NextResponse.json({ error: 'Missing date or lang' }, { status: 400 })
        }

        const progressKey = `review:${userId}:${date}:${lang}`

        // Check if we already have a flashback for this date
        const existingFlashback = await getFlashback({ userId, date, lang })

        if (existingFlashback) {
            // Return existing data immediately
            await redis.set(progressKey, {
                stage: 'complete',
                story: existingFlashback.story,
                translations: existingFlashback.translations,
            })
            console.log('Returning cached flashback for review generation')
            return NextResponse.json({ success: true, cached: true })
        }

        // Initialize progress
        await redis.set(progressKey, {
            stage: 'story',
            story: null,
            translations: null,
        })

        // Trigger Upstash Workflow
        await generateStory({ date, lang, userId, progressKey })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error starting review generation:', error)
        return NextResponse.json({ error: 'Failed to start generation' }, { status: 500 })
    }
}
