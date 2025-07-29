import { calculateStreak } from '@/server/db/memories'
import { getUserOrThrow } from '@/server/auth/user'
import { StreakDisplay } from './streak-display'
import StoneSkeleton from '@/components/ui/stone-skeleton'

export async function Streak() {
    const { userId } = await getUserOrThrow()
    const streakData = await calculateStreak(userId)

    return <StreakDisplay streakData={streakData} />
}

export function StreakSkeleton() {
    return <StoneSkeleton className='h-[216px] sm:h-[292px] w-full rounded-lg' />
}
