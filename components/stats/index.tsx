import { getXataClient } from '@/lib/xata'
import WordChart from './word-chart'
import moment from 'moment'

async function getLibraryList({ uid }: { uid: string }) {
    const xata = getXataClient()

    const libraries = await xata.db.libraries.filter({
        owner: uid
    }).getMany()

    return libraries.map(lib => lib.id)
}

export default async function WordStats({ uid }: { uid: string }) {
    const xata = getXataClient()
    const libraryList = await getLibraryList({ uid })

    const results = await xata.db.lexicon.aggregate({
        wordsByDate: {
            dateHistogram: {
                column: 'day',
                calendarInterval: 'day',
            }
        }
    }, {
        $all: [
            {
                day: {
                    $ge: moment().subtract(30, 'days').toDate()
                }
            },
            {
                lib: {
                    $any: libraryList
                }
            }
        ]
    })

    const countMap = new Map(
        results.aggs.wordsByDate.values.map(bucket => [
            new Date(bucket.$key).toISOString().split('T')[0],
            bucket.$count
        ])
    )

    return <WordChart data={formarChartData(countMap)} />
}

export function formarChartData(countMap: Map<string, number>) {
    const dates = Array.from({ length: 30 }, (_, i) => {
        const d = moment().subtract(i, 'days').toDate()
        return d.toISOString().split('T')[0]
    }).reverse()

    const data = dates.map(date => ({
        date: new Date(date).toLocaleDateString('zh-CN'),
        Count: countMap.get(date) || 0
    }))

    return data
}
