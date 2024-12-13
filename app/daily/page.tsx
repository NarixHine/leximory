import Main from '@/components/main'
import H from '@/components/h'
import { Suspense } from 'react'
import Report from './report'
import Bell from './bell'
import { Spacer } from '@nextui-org/spacer'
import { Skeleton } from '@nextui-org/skeleton'
import { auth } from '@clerk/nextjs/server'
import { getXataClient } from '@/lib/xata'
import { Metadata } from 'next'
import WordStats from './word-stats'
import { WordChartSkeleton } from './word-chart'

export const metadata: Metadata = {
    title: '每日汇总',
}

export default async function Daily() {
    const xata = getXataClient()
    const hasSubscribed = !!(await xata.db.subs.filter({ uid: (await auth()).userId }).getFirst())

    return (
        <Main className='max-w-screen-lg pt-12'>
            <H>每日汇总</H>
            <div className='my-12 h-80'>
                <Suspense fallback={<WordChartSkeleton />}>
                    <WordStats />
                </Suspense>
            </div>
            <Spacer y={6}></Spacer>
            <Bell hasSubscribed={hasSubscribed}></Bell>
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
    )
}

const Loading = () => (<div className='my-8 overflow-hidden'>
    <Skeleton className='w-20 rounded-lg h-7'></Skeleton>
    <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 my-5'>
        <Skeleton className='w-full h-32 rounded-lg'></Skeleton>
        <Skeleton className='w-full h-32 rounded-lg hidden sm:block'></Skeleton>
        <Skeleton className='w-full h-32 rounded-lg hidden md:block'></Skeleton>
    </div>
</div>)
