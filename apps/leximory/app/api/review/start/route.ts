import { NextResponse } from 'next/server'
import { getUserOrThrow } from '@repo/user'
import { startReview } from '@/server/review/start'

export async function POST(request: Request) {
    try {
        const { userId } = await getUserOrThrow()
        return await startReview(request, userId)
    } catch (error) {
        console.error('Error starting review generation:', error)
        return NextResponse.json({ error: 'Failed to start generation' }, { status: 500 })
    }
}
