import { getXataClient } from '@/lib/xata'
import WordChart from './word-chart'
import moment from 'moment'
import { auth } from '@clerk/nextjs/server'

async function getLibraryList() {
    const xata = getXataClient()
    const { userId } = await auth()

    const libraries = await xata.db.libraries.filter({
        owner: userId!
    }).getMany()

    return libraries.map(lib => lib.id)
}

export default async function WordStats() {
    const xata = getXataClient()
    const libraryList = await getLibraryList()

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

    const dates = Array.from({ length: 30 }, (_, i) => {
        const d = moment().subtract(i, 'days').toDate()
        return d.toISOString().split('T')[0]
    }).reverse()

    const countMap = new Map(
        results.aggs.wordsByDate.values.map(bucket => [
            new Date(bucket.$key).toISOString().split('T')[0],
            bucket.$count
        ])
    )

    const data = dates.map(date => ({
        date: new Date(date).toLocaleDateString('zh-CN'),
        Count: countMap.get(date) || 0
    }))

    return <WordChart data={data} />
} 