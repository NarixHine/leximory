import WordChart from './word-chart'
import moment from 'moment'
import { getData } from './actions'
import VocabularyCalendar from './calendar'
import { getAuthOrThrow } from '@/server/auth/role'

const getCountMap = async (uid: string) => {
    'use cache'
    const data = await getData(uid)
    return new Map(
        data.map(bucket => [
            new Date(bucket.$key).toISOString().split('T')[0],
            bucket.$count
        ])
    )
}

export async function WordStats({ uid }: { uid: string }) {
    'use cache'
    const countMap = await getCountMap(uid)
    return <WordChart data={formatChartData(countMap, 30)} />
}

export async function UserWordStats() {
    const { userId } = await getAuthOrThrow()
    return <WordHeatmap uid={userId} />
}

export async function WordHeatmap({ uid }: { uid: string }) {
    'use cache'
    const countMap = await getCountMap(uid)
    return <VocabularyCalendar wordCountData={countMap} />
}

export async function UserWordHeatmap() {
    const { userId } = await getAuthOrThrow()
    return <WordHeatmap uid={userId} />
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
