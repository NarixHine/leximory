import { WordStats } from '@/components/stats'
import { WordChartSkeleton } from '@/components/stats/word-chart'
import { Suspense } from 'react'
import { unstable_cacheLife as cacheLife } from 'next/cache'

export default async function WordStatsSection({ uid }: { uid: string }) {
    'use cache'
    cacheLife('days')
 
    return (
        <div className='h-80 flex-1 sm:min-w-96'>
            <Suspense fallback={<WordChartSkeleton />}>
                <WordStats uid={uid} />
            </Suspense>
        </div>
    )
} 