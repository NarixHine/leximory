import { calculateStreak } from '@/server/db/memories'
import { getUserOrThrow } from '@/server/auth/user'
import { StreakDisplay } from './streak-display'
import { cn } from '@/lib/utils'
import { bgColor } from './constants'

export async function StreakServer({ compact = false }: { compact?: boolean }) {
    const { userId } = await getUserOrThrow()
    const streakData = await calculateStreak(userId)

    return <StreakDisplay streakData={streakData} compact={compact} />
}

export function StreakSkeleton() {
    return <div className={cn('h-77 sm:h-58 w-full rounded-lg animate-pulse', bgColor)} />
}

export function CompactStreakSkeleton() {
    return <div className={cn('h-15 w-full rounded-lg animate-pulse', bgColor)} />
}
