import 'server-only'
import { Lang } from '@repo/env/config'
import { stdMoment } from '@repo/utils'
import { getReviewCompletion, type ReviewConversation, type ReviewTranslation } from '@/lib/review'
import { getTimelineWords } from '@/server/db/word'
import { listFlashbacksForReviewProgress, listFlashbacksWithin } from '@/server/db/flashback'

const REVIEW_STREAK_THRESHOLD = 60
const REVIEW_STREAK_PAGE_SIZE = 64
const REVIEW_STREAK_MARKER_DAYS = 8

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
    progressByLang: Partial<Record<Lang, {
        percentage: number
        conversationCompleted: boolean
    }>>
    isToday: boolean
}

export interface TimelineData {
    days: DayData[]
    streak: ReviewStreakData
}

export interface ReviewStreakData {
    total: number
    checkDays: {
        date: string
        displayDate: string
        dayOfWeek: string
        completed: boolean
    }[]
    threshold: number
    isTodayActive: boolean
}

export async function getTimelineData(userId: string): Promise<TimelineData> {
    const [wordRows, streak] = await Promise.all([
        getTimelineWords({ userId, limit: 100 }),
        getReviewStreakData(userId),
    ])

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
        return { days: [], streak }
    }

    const startDate = dates[dates.length - 1]
    const endDate = dates[0]
    const flashbackRows = await listFlashbacksWithin({
        userId,
        startDate,
        endDate,
    })

    const flashbackByDateAndLang = new Map<string, {
        story: string
        translations: ReviewTranslation[]
        conversation: ReviewConversation | null
    }>()
    for (const row of flashbackRows) {
        flashbackByDateAndLang.set(`${row.date}:${row.lang}`, {
            story: row.story,
            translations: row.translations,
            conversation: row.conversation,
        })
    }

    const days = dates.map((date) => {
        const momentDate = stdMoment(date)
        const words = wordsByDate.get(date) ?? []
        const langs = [...new Set(words.map(w => w.lang))]
        const progressByLang: DayData['progressByLang'] = {}
        for (const lang of langs) {
            const flashback = flashbackByDateAndLang.get(`${date}:${lang}`)
            const completion = getReviewCompletion({
                story: flashback?.story,
                translations: flashback?.translations,
                conversation: flashback?.conversation,
            })
            progressByLang[lang] = {
                percentage: completion.percentage,
                conversationCompleted: completion.conversationCompleted,
            }
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

    return { days, streak }
}

async function getReviewStreakData(userId: string): Promise<ReviewStreakData> {
    const today = stdMoment().startOf('day')
    const todayKey = today.format('YYYY-MM-DD')
    const yesterday = today.clone().subtract(1, 'day')
    const streakDates = new Set<string>()
    let isTodayActive = false
    let from = 0
    let currentDate: string | null = null
    let currentDateActive = false
    let expectedDate: ReturnType<typeof stdMoment> | null = null
    let done = false

    const finishDate = (dateKey: string, active: boolean) => {
        const date = stdMoment(dateKey).startOf('day')

        if (dateKey === todayKey) {
            isTodayActive = active
        }

        if (!expectedDate) {
            if (date.isSame(today, 'day')) {
                if (!active) return
                expectedDate = today.clone()
            } else if (date.isSame(yesterday, 'day')) {
                if (!active) {
                    done = true
                    return
                }
                expectedDate = yesterday.clone()
            } else {
                done = true
                return
            }
        }

        if (!date.isSame(expectedDate, 'day') || !active) {
            done = true
            return
        }

        streakDates.add(dateKey)
        expectedDate = expectedDate.clone().subtract(1, 'day')
    }

    while (!done) {
        const rows = await listFlashbacksForReviewProgress({
            userId,
            from,
            to: from + REVIEW_STREAK_PAGE_SIZE - 1,
        })

        if (rows.length === 0) {
            if (currentDate) {
                finishDate(currentDate, currentDateActive)
            }
            break
        }

        for (const row of rows) {
            if (currentDate && row.date !== currentDate) {
                finishDate(currentDate, currentDateActive)
                if (done) break
                currentDateActive = false
            }

            currentDate = row.date
            if (!currentDateActive) {
                const completion = getReviewCompletion({
                    story: row.story,
                    translations: row.translations,
                    conversation: row.conversation,
                })
                currentDateActive = completion.percentage >= REVIEW_STREAK_THRESHOLD
            }
        }

        if (done || rows.length < REVIEW_STREAK_PAGE_SIZE) {
            if (!done && currentDate) {
                finishDate(currentDate, currentDateActive)
            }
            break
        }

        from += REVIEW_STREAK_PAGE_SIZE
    }

    const checkDays = Array.from({ length: REVIEW_STREAK_MARKER_DAYS }, (_, index) => {
        const date = today.clone().subtract(REVIEW_STREAK_MARKER_DAYS - index - 1, 'day')
        const dateKey = date.format('YYYY-MM-DD')

        return {
            date: dateKey,
            displayDate: date.format('M/D'),
            dayOfWeek: date.format('ddd'),
            completed: streakDates.has(dateKey),
        }
    })

    return {
        total: streakDates.size,
        checkDays,
        threshold: REVIEW_STREAK_THRESHOLD,
        isTodayActive,
    }
}
