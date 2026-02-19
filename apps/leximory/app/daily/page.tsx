import Main from '@/components/ui/main'
import H from '@/components/ui/h'
import { Suspense } from 'react'
import Report from './components/report'
import Bell from './components/bell-server'
import { Spacer } from "@heroui/spacer"
import { Metadata } from 'next'
import { WordChartSkeleton } from '@/components/stats/word-chart'
import { UserWordStats } from '@/components/stats'
import { PiRewindDuotone } from 'react-icons/pi'
import StoneSkeleton from '@/components/ui/stone-skeleton'
import { BellSkeleton } from './components/bell'

export const metadata: Metadata = {
    title: '每日汇总',
}

export default async function Daily() {
    return (<Main className='max-w-(--breakpoint-lg) pt-12'>
        <header className='mb-2 mx-auto w-full max-w-108 sm:max-w-133 flex items-center gap-6'>
            <h1 className='text-3xl flex items-center gap-1 font-bold text-default-500'><PiRewindDuotone />每日汇总</h1>
            <Suspense fallback={<BellSkeleton></BellSkeleton>}>
                <Bell />
            </Suspense>
        </header>
        <div className='mb-4 h-80'>
            <Suspense fallback={<WordChartSkeleton />}>
                <UserWordStats />
            </Suspense>
        </div>
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
    </Main>)
}

const Loading = () => (<div className='my-8 overflow-hidden'>
    <StoneSkeleton className='w-20 rounded-lg h-7' />
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 my-5'>
        <StoneSkeleton className='w-full h-32 rounded-lg'></StoneSkeleton>
        <StoneSkeleton className='w-full h-32 rounded-lg hidden sm:block'></StoneSkeleton>
        <StoneSkeleton className='w-full h-32 rounded-lg hidden md:block'></StoneSkeleton>
    </div>
</div>)
