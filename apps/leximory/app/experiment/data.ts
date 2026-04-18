import { getUserOrThrow } from '@repo/user'
import { listLibs } from '@/server/db/lib'
import { aggrWordHistogram, getWordsWithin } from '@/server/db/word'
import { Lang } from '@repo/env/config'
import { stdMoment } from '@repo/utils'

export interface DayData {
    date: string
    displayDate: string
    dayOfWeek: string
    words: Array<{
        id: string
        word: string
        lang: Lang
        lib: string
    }>
    count: number
    progress: number // 0-100 random progress for review
    isToday: boolean
}

export interface TimelineData {
    days: DayData[]
    maxCount: number
}

export async function getTimelineData(): Promise<TimelineData> {
    const { userId } = await getUserOrThrow()
    const libs = await listLibs({ owner: userId })
    
    // Get histogram data for the last 15 days
    const histogram = await aggrWordHistogram({ libs, size: 15 })
    const countMap = new Map(histogram.map(h => [h.date, h.count]))
    
    // Generate last 15 days - today first (at top), then going back
    const days: DayData[] = []
    
    for (let i = 0; i < 15; i++) {
        // i=0 is today, i=1 is yesterday, etc.
        const fromDayAgo = i
        const toDayAgo = i - 1  // to get a single day's range
        
        const words = await getWordsWithin({
            fromDayAgo,
            toDayAgo,
            userId
        })
        
        const date = stdMoment().subtract(i, 'days')
        const dateStr = date.format('YYYY-MM-DD')
        
        // Random progress for now (0-100)
        const progress = Math.floor(Math.random() * 101)
        
        days.push({
            date: dateStr,
            displayDate: date.format('M月D日'),
            dayOfWeek: date.format('ddd'),
            words: words.map(w => ({ ...w, lang: w.lang as Lang })),
            count: countMap.get(dateStr) || words.length, // fallback to words.length if histogram missing
            progress,
            isToday: i === 0
        })
    }
    
    const maxCount = Math.max(...days.map(d => d.count), 1)
    
    return { days, maxCount }
}
