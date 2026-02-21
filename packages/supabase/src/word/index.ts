import 'server-only'
import { FORGET_CURVE, ForgetCurvePoint, Lang } from '@repo/env/config'
import { supabase } from '@repo/supabase'
import { cacheLife, cacheTag } from 'next/cache'
import { validateOrThrow, stdMoment } from '@repo/utils'
import { getShadowLib } from '../library'
import { getWelcomeWord } from '@repo/languages'

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
            date: created_at ? stdMoment(created_at).format('YYYY-MM-DD') : '',
        })),
        cursor: cursor ? (parseInt(cursor) + 20).toString() : '20',
        more: data.length === 20
    }
}

export async function retrieveWordsWithRange({ lib, start, end, size = 200 }: { lib: string, start: Date, end: Date, size?: number }) {
    const { data } = await supabase
        .from('lexicon')
        .select('word, id')
        .eq('lib', lib)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .not('word', 'in', `(${Object.values({ en: getWelcomeWord('en'), zh: getWelcomeWord('zh'), ja: getWelcomeWord('ja'), nl: getWelcomeWord('nl') }).join(',')})`)
        .limit(size)
        .throwOnError()
    return data
}

export async function getForgetCurve({ day, userId }: { day: ForgetCurvePoint, userId: string }) {
    const data = await getWordsWithin({ fromDayAgo: FORGET_CURVE[day][0], toDayAgo: FORGET_CURVE[day][1], userId })
    return data
}

export async function getWordsWithin({ fromDayAgo, toDayAgo, userId }: { fromDayAgo: number, toDayAgo: number, userId: string }) {
    'use cache'
    cacheTag('words')
    cacheLife('hours')
    const welcomeWords = Object.values({ en: getWelcomeWord('en'), zh: getWelcomeWord('zh'), ja: getWelcomeWord('ja'), nl: getWelcomeWord('nl') })
    const { data } = await supabase
        .from('lexicon')
        .select('word, id, lib:libraries!inner(id, lang)')
        .gte('created_at', stdMoment().startOf('day').subtract(fromDayAgo, 'day').toISOString())
        .lte('created_at', stdMoment().startOf('day').subtract(toDayAgo, 'day').toISOString())
        .not('word', 'in', `(${welcomeWords.join(',')})`)
        .eq('lib.owner', userId)
        .throwOnError()
    return data.map(({ word, id, lib }) => ({ word, id, lang: lib.lang as Lang, lib: lib.id }))
}

export async function aggrWordHistogram({ libs, size }: { libs: string[], size: number }) {
    if (libs.length === 0) {
        return []
    }
    const startDate = stdMoment().subtract(size, 'days').toDate()

    const { data } = await supabase
        .from('lexicon')
        .select('created_at')
        .in('lib', libs)
        .gte('created_at', startDate.toISOString())
        .throwOnError()

    const histogram = data.reduce((acc: Record<string, number>, curr) => {
        const date = stdMoment(curr.created_at).startOf('day').format('YYYY-MM-DD')
        acc[date] = (acc[date] || 0) + 1
        return acc
    }, {})

    return Object.entries(histogram).map(([date, count]) => ({
        date,
        count
    }))
}
