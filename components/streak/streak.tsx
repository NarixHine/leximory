import { calculateStreak } from '@/server/db/memories'
import { getUserOrThrow } from '@/server/auth/user'
import { StreakDisplay } from './streak-display'
import StoneSkeleton from '@/components/ui/stone-skeleton'

export async function StreakServer({ compact = false }: { compact?: boolean }) {
    const { userId } = await getUserOrThrow()
    const streakData = await calculateStreak(userId)

    return <StreakDisplay streakData={streakData} compact={compact} />
}

export function StreakSkeleton() {
    return <StoneSkeleton className='h-77 sm:h-58 w-full rounded-lg' />
}

export function CompactStreakSkeleton() {
    return <StoneSkeleton className='h-15 w-full rounded-lg' />
}
