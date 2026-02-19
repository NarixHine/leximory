import WordChart from './word-chart'
import VocabularyCalendar, { HeatmapSkeleton } from './calendar'
import { getUserOrThrow } from '@repo/user'
import { listLibs } from '@/server/db/lib'
import { aggrWordHistogram } from '@/server/db/word'
import { AvailableChartColorsKeys } from '@/components/stats/chart-utils'
import { Suspense } from 'react'
import { momentSH } from '@/lib/moment'

const getCountMap = async ({ uid }: { uid: string }) => {
    'use cache'
    const libs = await listLibs({ owner: uid })
    const results = await aggrWordHistogram({ libs, size: 30 })
    return new Map(
        results.map(bucket => [
            bucket.date,
            bucket.count
        ])
    )
}

export async function WordStats({ uid, color }: { uid: string, color?: AvailableChartColorsKeys }) {
    'use cache'
    const countMap = await getCountMap({ uid })
    return <WordChart data={formatChartData(countMap, 30)} color={color} />
}

export async function UserWordStats({ color = 'secondary' }: { color?: AvailableChartColorsKeys }) {
    const { userId } = await getUserOrThrow()
    return <WordStats uid={userId} color={color} />
}

export async function WordHeatmap({ uid }: { uid: string }) {
    const countMap = await getCountMap({ uid })
    return <Suspense fallback={<HeatmapSkeleton />}><VocabularyCalendar wordCountData={countMap} /></Suspense>
}

export async function UserWordHeatmap() {
    const { userId } = await getUserOrThrow()
    return <WordHeatmap uid={userId} />
}

export function formatChartData(countMap: Map<string, number>, size: number) {
    const dates = Array.from({ length: size }, (_, i) => {
        const d = momentSH().subtract(i, 'days').toDate()
        return d.toISOString().split('T')[0]
    }).reverse()

    const data = dates.map(date => ({
        date: momentSH(date).format('ll'),
        '记忆单词数': countMap.get(date) || 0
    }))

    return data
}
