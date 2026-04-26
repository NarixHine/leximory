import { getUserOrThrow } from '@repo/user'
import { Lang } from '@repo/env/config'
import { stdMoment } from '@repo/utils'
import { getReviewCompletion, type ReviewTranslation } from '@/lib/review'
import { getTimelineWords } from '@/server/db/word'
import { listFlashbacksWithin } from '@/server/db/flashback'

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
    progressByLang: Record<Lang, number>
    isToday: boolean
}

export interface TimelineData {
    days: DayData[]
}

export async function getTimelineData(): Promise<TimelineData> {
    const { userId } = await getUserOrThrow()
    const wordRows = await getTimelineWords({ userId, limit: 100 })

    const wordsByDate = new Map<string, DayData['words']>()
    for (const row of wordRows) {
        const date = stdMoment(row.createdAt).format('YYYY-MM-DD')
        const words = wordsByDate.get(date) ?? []
        words.push({
            id: row.id,
            word: row.word,
            lang: row.lang,
            lib: row.lib,
        })
        wordsByDate.set(date, words)
    }

    const dates = Array.from(wordsByDate.keys()).sort((left, right) => right.localeCompare(left))
    if (dates.length === 0) {
        return { days: [] }
    }

    const flashbackRows = await listFlashbacksWithin({
        userId,
        startDate: dates[dates.length - 1],
        endDate: dates[0],
    })

    const flashbackByDateAndLang = new Map<string, { story: string; translations: ReviewTranslation[] }>()
    for (const row of flashbackRows) {
        flashbackByDateAndLang.set(`${row.date}:${row.lang}`, {
            story: row.story,
            translations: row.translations,
        })
    }

    const days = dates.map((date) => {
        const momentDate = stdMoment(date)
        const words = wordsByDate.get(date) ?? []
        const langs = [...new Set(words.map(w => w.lang))]
        const progressByLang = {} as Record<Lang, number>
        for (const lang of langs) {
            const flashback = flashbackByDateAndLang.get(`${date}:${lang}`)
            progressByLang[lang] = getReviewCompletion({
                story: flashback?.story,
                translations: flashback?.translations,
            }).percentage
        }

        return {
            date,
            displayDate: momentDate.format('M月D日'),
            dayOfWeek: momentDate.format('ddd'),
            words,
            count: words.length,
            progressByLang,
            isToday: stdMoment().isSame(momentDate, 'day'),
        }
    })

    return { days }
}
