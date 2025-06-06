import WordChart from './word-chart'
import moment from 'moment'
import VocabularyCalendar from './calendar'
import { getAuthOrThrow } from '@/server/auth/role'
import { listLibs } from '@/server/db/lib'
import { aggrWordHistogram } from '@/server/db/word'

const getCountMap = async ({ uid, orgId }: { uid: string, orgId?: string }) => {
    'use cache'
    const libs = await listLibs({ owner: uid, orgId })
    const results = await aggrWordHistogram({ libs, size: 30 })
    return new Map(
        results.map(bucket => [
            bucket.date,
            bucket.count
        ])
    )
}

export async function WordStats({ uid, orgId }: { uid: string, orgId?: string }) {
    'use cache'
    const countMap = await getCountMap({ uid, orgId })
    return <WordChart data={formatChartData(countMap, 30)} />
}

export async function UserWordStats() {
    const { userId, orgId } = await getAuthOrThrow()
    return <WordStats uid={userId} orgId={orgId} />
}

export async function WordHeatmap({ uid, orgId }: { uid: string, orgId?: string }) {
    'use cache'
    const countMap = await getCountMap({ uid, orgId })
    return <VocabularyCalendar wordCountData={countMap} />
}

export async function UserWordHeatmap() {
    const { userId, orgId } = await getAuthOrThrow()
    return <WordHeatmap uid={userId} orgId={orgId} />
}

export function formatChartData(countMap: Map<string, number>, size: number) {
    const dates = Array.from({ length: size }, (_, i) => {
        const d = moment().subtract(i, 'days').toDate()
        return d.toISOString().split('T')[0]
    }).reverse()

    const data = dates.map(date => ({
        date: moment(date).format('MMM Do'),
        '记忆单词数': countMap.get(date) || 0
    }))

    return data
}
