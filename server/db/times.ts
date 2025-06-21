'use cache'
import 'server-only'
import { supabase } from '@/server/client/supabase'
import { unstable_cacheTag as cacheTag } from 'next/cache'
import { TimesSummaryData, TimesData } from '@/components/times/types'
import { TIMES_PAGE_SIZE } from '@/lib/config'

export async function getRecentTimesData(page: number = 1, pageSize: number = TIMES_PAGE_SIZE) {
    cacheTag('times')

    const { data, count } = await supabase
        .from('times')
        .select('date, cover', { count: 'exact' })
        .order('date', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1)
        .throwOnError()

    return {
        data: data as TimesSummaryData[],
        hasMore: count ? count > page * pageSize : false,
    }
}

export async function getTimesDataByDate(date: string) {
    cacheTag('times')

    const { data } = await supabase
        .from('times')
        .select('date, cover, news, novel')
        .eq('date', date)
        .single()
        .throwOnError()

    return data as TimesData
}

export async function getLatestTimesData() {
    cacheTag('times')

    const { data } = await supabase
        .from('times')
        .select('date, cover, news, novel')
        .order('date', { ascending: false })
        .limit(1)
        .throwOnError()

    return data[0]
}
