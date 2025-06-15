'use cache'
import 'server-only'
import { supabase } from '@/server/client/supabase'
import { unstable_cacheTag as cacheTag } from 'next/cache'
import { TimesSummaryData, TimesData } from '@/components/times/types'

export async function getRecentTimesData() {
    cacheTag('times')

    const { data } = await supabase
        .from('times')
        .select('date, cover')
        .order('date', { ascending: false })
        .limit(7)
        .throwOnError()

    return data as TimesSummaryData[]
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
