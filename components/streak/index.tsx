import { Suspense } from 'react'
import { StreakSkeleton, StreakServer, CompactStreakSkeleton } from './streak'

export default function Streak({ compact }: { compact?: boolean }) {
    return <Suspense fallback={compact ? <CompactStreakSkeleton /> : <StreakSkeleton />}>
        <StreakServer compact={compact} />
    </Suspense>
}
