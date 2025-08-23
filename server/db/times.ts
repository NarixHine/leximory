'use cache'
import 'server-only'
import { supabase } from '@/server/client/supabase'
import { unstable_cacheTag as cacheTag } from 'next/cache'
import { TimesSummaryData, TimesData, TimesDataWithRaw } from '@/components/times/types'
import { TIMES_PAGE_SIZE } from '@/lib/config'

export async function getRecentTimesData(page: number = 1) {
    cacheTag('times')

    const { data, count } = await supabase
        .from('times')
        .select('date, cover', { count: 'exact' })
        .order('date', { ascending: false })
        .range((page - 1) * TIMES_PAGE_SIZE, page * TIMES_PAGE_SIZE - 1)
        .throwOnError()

    return {
        data: data as TimesSummaryData[],
        hasMore: count ? count > page * TIMES_PAGE_SIZE : false,
    }
}

export async function getTimesDataByDate(date: string) {
    cacheTag('times')

    const { data } = await supabase
        .from('times')
        .select('date, cover, news, novel, quiz, audio, is_sequel')
        .eq('date', date)
        .single()
        .throwOnError()

    return data as TimesData
}

export async function getRawNewsByDate(date: string) {
    cacheTag('times')

    const { data } = await supabase
        .from('times')
        .select('raw_news')
        .eq('date', date)
        .single()
        .throwOnError()

    return data.raw_news
}

export async function publishTimes(data: TimesDataWithRaw) {
    return await supabase
        .from('times')
        .insert(data)
}

export async function updateTimes(date: string, data: Partial<TimesDataWithRaw>) {
    return await supabase
        .from('times')
        .update(data)
        .eq('date', date)
        .throwOnError()
}

export async function getLatestTimesData() {
    cacheTag('times')

    const { data } = await supabase
        .from('times')
        .select('date, cover, news, novel, quiz, audio, is_sequel')
        .order('date', { ascending: false })
        .limit(1)
        .throwOnError()

    return data[0] as TimesData
}

export async function removeIssue(date: string) {
    await supabase
        .from('times')
        .delete()
        .eq('date', date)
}

export async function getAllTimesData() {
    cacheTag('times')

    const { data } = await supabase
        .from('times')
        .select('date, cover')
        .order('date', { ascending: false })
        .throwOnError()

    return data as TimesSummaryData[]
}
