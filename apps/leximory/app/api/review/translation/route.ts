import { NextResponse } from 'next/server'
import { getUserOrThrow } from '@repo/user'
import { submitReviewTranslation } from '@/server/review/translation'

export async function POST(request: Request) {
    try {
        const { userId } = await getUserOrThrow()
        return await submitReviewTranslation(request, userId)
    } catch (error) {
        console.error('Failed to submit review translation:', error)
        return NextResponse.json({ error: 'Failed to submit translation' }, { status: 500 })
    }
}
