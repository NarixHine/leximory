import WordChart from './word-chart'
import moment from 'moment'
import { getData } from './actions'

export default async function WordStats({ uid }: { uid: string }) {
    const data = await getData(uid)

    const countMap = new Map(
        data.map(bucket => [
            new Date(bucket.$key).toISOString().split('T')[0],
            bucket.$count
        ])
    )

    return <WordChart data={formatChartData(countMap)} />
}

export function formatChartData(countMap: Map<string, number>) {
    const dates = Array.from({ length: 30 }, (_, i) => {
        const d = moment().subtract(i, 'days').toDate()
        return d.toISOString().split('T')[0]
    }).reverse()

    const data = dates.map(date => ({
        date: new Date(date).toLocaleDateString('zh-CN'),
        '记忆单词数': countMap.get(date) || 0
    }))

    return data
}
