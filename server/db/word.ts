import 'server-only'

import { forgetCurve, ForgetCurvePoint } from '@/app/daily/components/report'
import { Lang, welcomeMap } from '@/lib/config'
import { getXataClient } from '@/server/client/xata'
import moment from 'moment-timezone'
import { revalidateTag, unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from 'next/cache'
import { getShadowLib } from './lib'
import { validateOrThrow } from '@/lib/lang'
import { after } from 'next/server'

const xata = getXataClient()

export async function getAllWordsInLib({ lib }: { lib: string }) {
    'use cache'
    cacheTag(lib)
    return await xata.db.lexicon.filter({ lib }).select(['word', 'id']).getAll()
}

export async function getWord({ id }: { id: string }) {
    'use cache'
    cacheTag(id)
    return await xata.db.lexicon.filter({ id }).getFirstOrThrow()
}

export async function saveWord({ lib, word }: { lib: string, word: string }) {
    const sanitizedWord = word.replaceAll('\n', '').replace('||}}', '}}')
    validateOrThrow(sanitizedWord)
    const rec = await xata.db.lexicon.create({
        lib,
        word: sanitizedWord
    })
    after(() => {
        revalidateTag('words')
        revalidateTag(`words:${lib}`)
    })
    return rec
}

export async function shadowSaveWord({ word, uid, lang }: { word: string, uid: string, lang: Lang }) {
    const sanitizedWord = word.replaceAll('\n', '').replace('||}}', '}}')
    validateOrThrow(sanitizedWord)
    const shadowSaveLib = await getShadowLib({ owner: uid, lang })
    after(() => {
        revalidateTag('words')
        revalidateTag(`words:${shadowSaveLib.id}`)
    })
    return await saveWord({ lib: shadowSaveLib.id, word: sanitizedWord })
}


export async function updateWord({ id, word }: { id: string, word: string }) {
    const rec = await xata.db.lexicon.update(id, { word })
    return rec
}

export async function deleteWord(id: string) {
    const rec = await xata.db.lexicon.delete(id)
    after(() => {
        revalidateTag('words')
        revalidateTag(`words:${rec!.lib!.id}`)
    })
    return rec
}

export async function loadWords({ lib, cursor }: { lib: string, cursor?: string }) {
    const res = await xata.db.lexicon.filter({ lib }).sort('xata.createdAt', 'desc').select(['word']).getPaginated({
        pagination: { size: 20, after: cursor },
    })
    return { words: res.records.map(({ word, id, xata }) => ({ word, id, date: xata.createdAt.toISOString().split('T')[0] })), cursor: res.meta.page.cursor, more: res.meta.page.more }
}

export async function drawWords({ lib, start, end, size }: { lib: string, start: Date, end: Date, size: number }) {
    const words = await xata.db.lexicon.sort('*', 'random').select(['word']).filter({ 'lib.id': lib, 'xata.createdAt': { $gt: start, $lt: end } }).getMany({ pagination: { size } })
    return words
}

export async function getForgetCurve({ day, filter }: { day: ForgetCurvePoint, filter: Record<string, any> }) {
    'use cache'
    cacheTag('words')
    cacheLife('hours')
    const words = await xata.db.lexicon.select(['id', 'word', 'lib.lang']).filter({
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
    }).getAll()
    return words.map(({ word, id, lib }) => ({ word, id, lang: lib!.lang as Lang }))
}

export async function aggrWordHistogram({ libs, size }: { libs: string[], size: number }) {
    if (libs.length === 0) {
        return []
    }
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
                    $ge: moment().subtract(size, 'days').toDate()
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
