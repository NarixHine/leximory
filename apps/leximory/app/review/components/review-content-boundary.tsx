import { Suspense } from 'react'
import { ReviewContentSkeleton } from './review-content-skeleton'
import { ReviewContentServer } from './review-content-server'

export function ReviewContentBoundary() {
    return (
        <Suspense fallback={<ReviewContentSkeleton />}>
            <ReviewContentServer />
        </Suspense>
    )
}
