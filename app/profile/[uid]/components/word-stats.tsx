import { WordHeatmap, WordStats } from '@/components/stats'
import { WordChartSkeleton } from '@/components/stats/word-chart'
import { Suspense } from 'react'
import { unstable_cacheLife as cacheLife } from 'next/cache'
import { HeatmapSkeleton } from '@/components/stats/calendar'

export default async function WordStatsSection({ uid }: { uid: string }) {
    'use cache'
    cacheLife('days')

    return (
        <div className='flex flex-col basis-full md:basis-2/5 gap-4 sm:min-w-96'>
            <div>
                <Suspense fallback={<HeatmapSkeleton />}>
                    <WordHeatmap uid={uid} />
                </Suspense>
            </div>
            <div className='h-80'>
                <Suspense fallback={<WordChartSkeleton />}>
                    <WordStats uid={uid} color='primary' />
                </Suspense>
            </div>
        </div>
    )
} 
