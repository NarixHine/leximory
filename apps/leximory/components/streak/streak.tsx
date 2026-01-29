import { calculateStreak } from '@/server/db/memories'
import { getUserOrThrow } from '@repo/user'
import { StreakDisplay } from './streak-display'
import { cn } from '@/lib/utils'
import { bgColor } from './constants'

export async function StreakServer({ compact = false }: { compact?: boolean }) {
    const { userId } = await getUserOrThrow()
    const streakData = await calculateStreak(userId)

    return <StreakDisplay streakData={streakData} compact={compact} />
}

