import Main from '@/components/ui/main'
import { Suspense } from 'react'
import Report from './components/report'
import Bell from './components/bell-server'
import { Metadata } from 'next'
import { WordChartSkeleton } from '@/components/stats/word-chart'
import { UserWordStats } from '@/components/stats'
import { PiRewindDuotone } from 'react-icons/pi'
import { BellSkeleton } from './components/bell'

export const metadata: Metadata = {
    title: '每日汇总',
}

export default async function Daily() {
    return (<Main className='max-w-(--breakpoint-lg) pt-12'>
        <header className='mb-2 mx-auto w-full max-w-108 sm:max-w-133 flex items-start gap-3 sm:items-center flex-col sm:flex-row sm:gap-6'>
            <h1 className='text-3xl flex items-center gap-1 font-formal text-default-500 ml-5 sm:ml-0'><PiRewindDuotone />每日汇总</h1>
            <Suspense fallback={<BellSkeleton />}>
                <Bell />
            </Suspense>
        </header>
        <div className='mb-4'>
            <Suspense fallback={<WordChartSkeleton />}>
                <UserWordStats />
            </Suspense>
        </div>
        <Suspense fallback={<ReportSkeleton />}>
            <Report day='今天记忆' />
        </Suspense>
        <Suspense fallback={<ReportSkeleton />}>
            <Report day='一天前记忆' />
        </Suspense>
        <Suspense fallback={<ReportSkeleton />}>
            <Report day='四天前记忆' />
        </Suspense>
        <Suspense fallback={<ReportSkeleton />}>
            <Report day='七天前记忆' />
        </Suspense>
    </Main>)
}

/** Skeleton matching Report's columns-1 md:columns-2 lg:columns-3 layout */
function ReportSkeleton() {
    return (
        <div className='my-10'>
            <div className='flex items-center mb-4'>
                <div className='flex-1 h-px bg-default-200' />
                <div className='mx-4 h-5 w-28 animate-pulse rounded-full bg-default-100' />
                <div className='flex-1 h-px bg-default-200' />
            </div>
            <div className='columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4'>
                <div className='break-inside-avoid h-32 animate-pulse rounded-2xl bg-default-100' />
                <div className='break-inside-avoid h-24 animate-pulse rounded-2xl bg-default-100 hidden md:block' />
                <div className='break-inside-avoid h-28 animate-pulse rounded-2xl bg-default-100 hidden lg:block' />
            </div>
        </div>
    )
}
