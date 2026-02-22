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
    return (<Main className='pt-12 w-full! px-0! max-w-none mx-auto'>
        <div className='max-w-4xl px-5 sm:w-10/12 mx-auto'>
            <header className='mb-2 mx-auto w-full max-w-108 sm:max-w-133 flex items-start gap-3 sm:items-center flex-col sm:flex-row sm:gap-6'>
                <h1 className='text-3xl flex items-center gap-1 font-formal text-default-500 ml-5 sm:ml-0 font-bold'>
                    <PiRewindDuotone /> 每日汇总
                </h1>
                <Suspense fallback={<BellSkeleton />}>
                    <Bell />
                </Suspense>
            </header>
        </div>
        <div className='mb-4'>
            <Suspense fallback={<WordChartSkeleton />}>
                <UserWordStats />
            </Suspense>
        </div>
        <div className='max-w-4xl px-5 sm:w-10/12 mx-auto'>
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
        </div>
    </Main>)
}

/** Skeleton matching Report's columns-1 md:columns-2 lg:columns-3 layout */
function ReportSkeleton() {
    return (
        <div className='my-10 pt-1'>
            <div className='flex flex-row items-center mb-4'>
                <div className='flex-1 h-px bg-secondary-300/70 mr-5' />
                <h2 className='flex items-center font-bold text-lg tracking-widest text-secondary-400 mx-auto w-108 sm:w-133'>
                    <div className='flex gap-1 items-center'>
                        <div className='mx-4 h-5 w-28 animate-pulse rounded-full bg-default-100' />
                    </div>
                    <div className='flex-1 ml-3 h-px bg-secondary-300/70' />
                </h2>
                <div className='flex-1 h-px bg-secondary-300/70' />
            </div>
            <div className='columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4'>
                <div className='break-inside-avoid h-50 animate-pulse rounded-4xl bg-default-100' />
                <div className='break-inside-avoid h-50 animate-pulse rounded-4xl bg-default-100 hidden md:block' />
                <div className='break-inside-avoid h-50 animate-pulse rounded-4xl bg-default-100 hidden lg:block' />
            </div>
        </div>
    )
}
