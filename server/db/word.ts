import 'server-only'

import { forgetCurve, ForgetCurvePoint } from '@/app/daily/components/report'
import { welcomeMap } from '@/lib/config'
import { getXataClient } from '@/lib/xata'
import moment from 'moment-timezone'

const xata = getXataClient()

export async function getWord({ id }: { id: string }) {
    return await xata.db.lexicon.filter({ id }).getFirstOrThrow()
}

export async function getRecentWords({ filter }: { filter: Record<string, any> }) {
    const words = await xata
        .db
        .lexicon
        .filter({
            $all: [
                filter,
                {
                    $not: {
                        'word': { $any: Object.values(welcomeMap) }
                    }
                }
            ]
        })
        .sort('xata.createdAt', 'desc')
        .select(['lib.id', 'word'])
        .getMany({ pagination: { size: 10 } })
    return words.map(({ word, id }) => ({ word, id }))
}

export async function saveWord({ lib, word }: { lib: string, word: string }) {
    return await xata.db.lexicon.create({
        lib,
        word
    })
}

export async function updateWord({ id, word }: { id: string, word: string }) {
    return await xata.db.lexicon.update(id, { word })
}

export async function deleteWord(id: string) {
    return await xata.db.lexicon.delete(id)
}

export async function loadWords({ lib, cursor }: { lib: string, cursor?: string }) {
    const res = await xata.db.lexicon.filter({ lib }).sort('xata.createdAt', 'desc').select(['word']).getPaginated({
        pagination: { size: 16, after: cursor },
    })
    return { words: res.records.map(({ word, id, xata }) => ({ word, id, date: xata.createdAt.toISOString().split('T')[0] })), cursor: res.meta.page.cursor, more: res.meta.page.more }
}

export async function drawWords({ lib, start, end, size }: { lib: string, start: Date, end: Date, size: number }) {
    const words = await xata.db.lexicon.sort('*', 'random').select(['word']).filter({ 'lib.id': lib, 'xata.createdAt': { $gt: start, $lt: end } }).getMany({ pagination: { size } })
    return words.map(({ word, id }) => ({ word, id }))
}

export async function getForgetCurve({ day, filter }: { day: ForgetCurvePoint, filter: Record<string, any> }) {
    const words = await xata.db.lexicon.select(['id', 'word']).filter({
        $all: [
            filter,
            {
                'xata.createdAt': { $ge: moment().tz('Asia/Shanghai').startOf('day').subtract(forgetCurve[day][0], 'day').utc().toDate() }
            },
            {
                'xata.createdAt': { $lt: moment().tz('Asia/Shanghai').startOf('day').subtract(forgetCurve[day][1], 'day').utc().toDate() }
            },
            {
                $not: {
                    'word': { $any: Object.values(welcomeMap) }
                }
            }
        ]
    }).getMany({
        pagination: {
            size: 50,
        }
    })
    return words.map(({ word, id }) => ({ word, id }))
}

export async function aggrMonthlyWordHistogram({ libs }: { libs: string[] }) {
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
                    $any: libs
                }
            }
        ]
    })
    return results.aggs.wordsByDate.values
}
