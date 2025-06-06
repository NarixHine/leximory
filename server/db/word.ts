import 'server-only'

import { forgetCurve, ForgetCurvePoint } from '@/app/daily/components/report'
import { Lang, welcomeMap } from '@/lib/config'
import { supabase } from '@/server/client/supabase'
import moment from 'moment-timezone'
import { revalidateTag, unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from 'next/cache'
import { getShadowLib } from './lib'
import { validateOrThrow } from '@/lib/lang'
import { after } from 'next/server'
import { OrFilter } from '../auth/role'

const sanitized = (word: string): string => word.replaceAll('\n', '').replace('||}}', '}}')

export async function getAllWordsInLib({ lib }: { lib: string }) {
    'use cache'
    cacheTag(lib)
    const { data } = await supabase
        .from('lexicon')
        .select('word, id')
        .eq('lib', lib)
        .throwOnError()
    return data
}

export async function getWord({ id }: { id: string }) {
    'use cache'
    cacheTag(id)
    const { data } = await supabase
        .from('lexicon')
        .select('*')
        .eq('id', id)
        .single()
        .throwOnError()
    return { ...data, lib: data.lib! }
}

export async function saveWord({ lib, word }: { lib: string, word: string }) {
    const sanitizedWord = sanitized(word)
    validateOrThrow(sanitizedWord)
    const { data } = await supabase
        .from('lexicon')
        .insert({ lib, word: sanitizedWord })
        .select()
        .single()
        .throwOnError()
    after(() => {
        revalidateTag('words')
        revalidateTag(`words:${lib}`)
    })
    return data
}

export async function shadowSaveWord({ word, uid, lang }: { word: string, uid: string, lang: Lang }) {
    const sanitizedWord = sanitized(word)
    validateOrThrow(sanitizedWord)
    const shadowSaveLib = await getShadowLib({ owner: uid, lang })
    return await saveWord({ lib: shadowSaveLib.id, word: sanitizedWord })
}

export async function updateWord({ id, word }: { id: string, word: string }) {
    const { data } = await supabase
        .from('lexicon')
        .update({ word })
        .eq('id', id)
        .select()
        .single()
        .throwOnError()
    return data
}

export async function deleteWord(id: string) {
    const { data } = await supabase
        .from('lexicon')
        .delete()
        .eq('id', id)
        .select('lib')
        .single()
        .throwOnError()
    after(() => {
        revalidateTag('words')
        revalidateTag(`words:${data.lib}`)
    })
    return data
}

export async function loadWords({ lib, cursor }: { lib: string, cursor?: string }) {
    const { data } = await supabase
        .from('lexicon')
        .select('word, id, created_at')
        .eq('lib', lib)
        .order('created_at', { ascending: false })
        .range(cursor ? parseInt(cursor) : 0, (cursor ? parseInt(cursor) : 0) + 19)
        .throwOnError()
    return {
        words: data.map(({ word, id, created_at }) => ({
            word,
            id,
            date: created_at ? new Date(created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        })),
        cursor: cursor ? (parseInt(cursor) + 20).toString() : '20',
        more: data.length === 20
    }
}

export async function drawWords({ lib, start, end, size }: { lib: string, start: Date, end: Date, size: number }) {
    const { data } = await supabase
        .from('lexicon')
        .select('word')
        .eq('lib', lib)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .limit(size)
        .throwOnError()
    return data
}

export async function getForgetCurve({ day, or: { filters, options } }: { day: ForgetCurvePoint, or: OrFilter }) {
    'use cache'
    cacheTag('words')
    cacheLife('hours')

    const startDate = moment().tz('Asia/Shanghai').startOf('day').subtract(forgetCurve[day][0], 'day').utc().toDate()
    const endDate = moment().tz('Asia/Shanghai').startOf('day').subtract(forgetCurve[day][1], 'day').utc().toDate()

    const { data } = await supabase
        .from('lexicon')
        .select('id, word, lib:libraries!inner(id, lang)')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .not('word', 'in', `(${Object.values(welcomeMap).map(w => `'${w}'`).join(',')})`)
        .or(filters, options)
        .throwOnError()

    return data.map(({ word, id, lib }) => ({ word, id, lang: lib.lang as Lang, lib: lib.id }))
}

export async function aggrWordHistogram({ libs, size }: { libs: string[], size: number }) {
    if (libs.length === 0) {
        return []
    }
    const startDate = moment().subtract(size, 'days').toDate()

    const { data } = await supabase
        .from('lexicon')
        .select('created_at')
        .in('lib', libs)
        .gte('created_at', startDate.toISOString())
        .throwOnError()

    // Group by date and count
    const histogram = data.reduce((acc: Record<string, number>, curr) => {
        const date = moment(curr.created_at).tz('Asia/Shanghai').startOf('day').utc().format('YYYY-MM-DD')
        acc[date] = (acc[date] || 0) + 1
        return acc
    }, {})

    return Object.entries(histogram).map(([date, count]) => ({
        date,
        count
    }))
}
