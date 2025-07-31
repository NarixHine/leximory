import Main from '@/components/ui/main'
import H from '@/components/ui/h'
import { Suspense } from 'react'
import Report from './components/report'
import Bell from './components/bell'
import { Spacer } from "@heroui/spacer"
import { Metadata } from 'next'
import { WordChartSkeleton } from '@/components/stats/word-chart'
import { UserWordStats } from '@/components/stats'
import { PiRewindDuotone } from 'react-icons/pi'
import { getSubsStatus } from '@/server/db/subs'
import { HydrationBoundary } from 'jotai-ssr'
import { hasSubsAtom } from './atoms'
import { getUserOrThrow } from '@/server/auth/user'
import StoneSkeleton from '@/components/ui/stone-skeleton'

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
            <Main className='max-w-(--breakpoint-lg) pt-12'>
                <H className='text-5xl font-bold text-warning-300'><PiRewindDuotone />每日汇总</H>
                <div className='mt-4 mb-12 h-80'>
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
    <StoneSkeleton className='w-20 rounded-lg h-7' />
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 my-5'>
        <StoneSkeleton className='w-full h-32 rounded-lg'></StoneSkeleton>
        <StoneSkeleton className='w-full h-32 rounded-lg hidden sm:block'></StoneSkeleton>
        <StoneSkeleton className='w-full h-32 rounded-lg hidden md:block'></StoneSkeleton>
    </div>
</div>)
