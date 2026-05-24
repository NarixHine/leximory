'use client'

import { Timeline } from './timeline'
import { ReviewStreakSkeleton } from './review-streak'

export function ReviewContentSkeleton() {
    return (
        <Timeline
            days={[]}
            streakSlot={<ReviewStreakSkeleton />}
            progressOverrides={{}}
            onReviewClick={() => {}}
        />
    )
}
