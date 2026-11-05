import { NextResponse } from 'next/server'
import { getUserOrThrow } from '@repo/user'
import { submitReviewConversation } from '@/server/review/conversation'

export async function POST(request: Request) {
    try {
        const { userId } = await getUserOrThrow()
        return await submitReviewConversation(request, userId)
    } catch (error) {
        console.error('Failed to submit review conversation:', error)
        return NextResponse.json({ error: 'Failed to submit conversation' }, { status: 500 })
    }
}
