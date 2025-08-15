import { Suspense } from 'react'
import { StreakSkeleton, StreakServer } from './streak'

export default function Streak() {
    return <Suspense fallback={<StreakSkeleton />}>
        <StreakServer />
    </Suspense>
}
