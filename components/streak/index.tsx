import { Suspense } from 'react'
import { StreakServer } from './streak'
import { StreakSkeleton, CompactStreakSkeleton } from './streak-display'

export default function Streak({ compact }: { compact?: boolean }) {
    return <Suspense fallback={compact ? <CompactStreakSkeleton /> : <StreakSkeleton />}>
        <StreakServer compact={compact} />
    </Suspense>
}
