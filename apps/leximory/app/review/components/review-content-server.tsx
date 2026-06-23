import { Suspense } from 'react'
import { getUserOrThrow } from '@repo/user'
import { getTimelineData } from '@/server/db/review'
import ExperimentClient from '../client'
import { ReviewStreakSkeleton } from './review-streak'
import { ReviewStreakServer } from './review-streak-server'

export async function ReviewContentServer() {
    const { userId } = await getUserOrThrow()
    const { days, nextCursor } = await getTimelineData(userId)

    return (
        <ExperimentClient
            initialDays={days}
            initialNextCursor={nextCursor}
            streakSlot={
                <Suspense fallback={<ReviewStreakSkeleton />}>
                    <ReviewStreakServer userId={userId} />
                </Suspense>
            }
        />
    )
}
