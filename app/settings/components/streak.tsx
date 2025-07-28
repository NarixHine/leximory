import { calculateStreak } from '@/server/db/memories'
import { getUserOrThrow } from '@/server/auth/user'
import { StreakDisplay } from './streak-display'
import { Skeleton } from '@heroui/react'

export async function Streak() {
    const { userId } = await getUserOrThrow()
    const streakData = await calculateStreak(userId)

    return <StreakDisplay streakData={streakData} />
}

export function StreakSkeleton() {
    return <Skeleton className='h-[232px] w-full rounded-lg' />
}
