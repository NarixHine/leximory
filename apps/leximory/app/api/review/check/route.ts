import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { getUserOrThrow } from '@repo/user'
import { checkReview } from '@/server/review/check'

export async function GET(request: Request) {
    try {
        const { userId } = await getUserOrThrow()
        return await checkReview(request, userId)
    } catch (error) {
        unstable_rethrow(error)
        console.error('Error checking flashback:', error)
        return NextResponse.json({ error: 'Failed to check flashback' }, { status: 500 })
    }
}
