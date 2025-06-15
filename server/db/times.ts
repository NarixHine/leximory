'use cache'
import 'server-only'
import { supabase } from '@/server/client/supabase'
import { unstable_cacheTag as cacheTag } from 'next/cache'
import { TimesSummaryData, TimesData } from '@/components/times/types'
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
        .select('date, cover, news, novel')
        .eq('date', date)
        .single()
        .throwOnError()

    return data as TimesData
}
