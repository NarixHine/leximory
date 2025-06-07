import Main from '@/components/ui/main'
import H from '@/components/ui/h'
import { Suspense } from 'react'
import Report from './components/report'
import Bell from './components/bell'
import { Spacer } from "@heroui/spacer"
import { Skeleton } from "@heroui/skeleton"
import { Metadata } from 'next'
import { WordChartSkeleton } from '@/components/stats/word-chart'
import { UserWordStats } from '@/components/stats'
import { PiRewindDuotone } from 'react-icons/pi'
import { getSubsStatus } from '@/server/db/subs'
import { HydrationBoundary } from 'jotai-ssr'
import { hasSubsAtom } from './atoms'
import { getUserOrThrow } from '@/server/auth/user'

export const metadata: Metadata = {
    title: '每日汇总',
}

export default async function Daily() {
    const { userId } = await getUserOrThrow()
    const { hasSubs, hour } = await getSubsStatus({ userId })

    return (
        <HydrationBoundary hydrateAtoms={[
            [hasSubsAtom, hasSubs]
        ]}>
            <Main className='max-w-screen-lg pt-12'>
                <H><PiRewindDuotone />每日汇总</H>
                <div className='my-12 h-80'>
                    <Suspense fallback={<WordChartSkeleton />}>
                        <UserWordStats />
                    </Suspense>
                </div>
                <Spacer y={6}></Spacer>
                <Bell hasSubs={hasSubs} hour={hour}></Bell>
                <Suspense fallback={<Loading></Loading>}>
                    <Report day='今天记忆'></Report>
                </Suspense>
                <Suspense fallback={<Loading></Loading>}>
                    <Report day='一天前记忆'></Report>
                </Suspense>
                <Suspense fallback={<Loading></Loading>}>
                    <Report day='四天前记忆'></Report>
                </Suspense>
                <Suspense fallback={<Loading></Loading>}>
                    <Report day='七天前记忆'></Report>
                </Suspense>
            </Main>
        </HydrationBoundary>
    )
}

const Loading = () => (<div className='my-8 overflow-hidden'>
    <Skeleton className='w-20 rounded-lg h-7'></Skeleton>
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 my-5'>
        <Skeleton className='w-full h-32 rounded-lg'></Skeleton>
        <Skeleton className='w-full h-32 rounded-lg hidden sm:block'></Skeleton>
        <Skeleton className='w-full h-32 rounded-lg hidden md:block'></Skeleton>
    </div>
</div>)
