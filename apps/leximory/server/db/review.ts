import 'server-only'
import { Lang } from '@repo/env/config'
import { stdMoment } from '@repo/utils'
import { getReviewCompletion, type ReviewConversation, type ReviewTranslation } from '@/lib/review'
import { getTimelineWords } from '@/server/db/word'
import { listFlashbacksWithin, type FlashbackReviewProgress } from '@/server/db/flashback'

const REVIEW_STREAK_THRESHOLD = 60
const REVIEW_STREAK_MARKER_DAYS = 7
const REVIEW_STREAK_LOOKBACK_DAYS = 30

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

    return { days }
}

export async function getReviewStreakData(userId: string): Promise<ReviewStreakData> {
    const today = stdMoment().startOf('day')
    const todayKey = today.format('YYYY-MM-DD')
    const yesterday = today.clone().subtract(1, 'day')
    const markerStart = today.clone().subtract(REVIEW_STREAK_MARKER_DAYS - 1, 'day')
    const reviewedDates = await getReviewedDatesWithin({
        userId,
        startDate: markerStart.format('YYYY-MM-DD'),
        endDate: todayKey,
    })
    const isTodayActive = reviewedDates.has(todayKey)
    const streakStart = isTodayActive
        ? today.clone()
        : reviewedDates.has(yesterday.format('YYYY-MM-DD'))
            ? yesterday.clone()
            : null
    const total = streakStart
        ? await countCurrentReviewStreak({
            userId,
            startDate: streakStart,
            reviewedDates,
            knownRangeStart: markerStart,
        })
        : 0

    const checkDays = Array.from({ length: REVIEW_STREAK_MARKER_DAYS }, (_, index) => {
        const date = today.clone().subtract(REVIEW_STREAK_MARKER_DAYS - index - 1, 'day')
        const dateKey = date.format('YYYY-MM-DD')

        return {
            date: dateKey,
            displayDate: date.format('M/D'),
            dayOfWeek: date.format('ddd'),
            completed: reviewedDates.has(dateKey),
        }
    })

    return {
        total,
        checkDays,
        threshold: REVIEW_STREAK_THRESHOLD,
        isTodayActive,
    }
}

async function countCurrentReviewStreak({
    userId,
    startDate,
    reviewedDates,
    knownRangeStart,
}: {
    userId: string
    startDate: ReturnType<typeof stdMoment>
    reviewedDates: Set<string>
    knownRangeStart: ReturnType<typeof stdMoment>
}) {
    let total = 0
    let cursor = startDate.clone()
    let earliestKnownDate = knownRangeStart.clone()

    while (true) {
        if (cursor.isBefore(earliestKnownDate, 'day')) {
            const nextRangeEnd = earliestKnownDate.clone().subtract(1, 'day')
            const nextRangeStart = nextRangeEnd.clone().subtract(REVIEW_STREAK_LOOKBACK_DAYS - 1, 'day')
            const olderReviewedDates = await getReviewedDatesWithin({
                userId,
                startDate: nextRangeStart.format('YYYY-MM-DD'),
                endDate: nextRangeEnd.format('YYYY-MM-DD'),
            })

            for (const dateKey of olderReviewedDates) {
                reviewedDates.add(dateKey)
            }
            earliestKnownDate = nextRangeStart
        }

        if (!reviewedDates.has(cursor.format('YYYY-MM-DD'))) {
            return total
        }

        total++
        cursor = cursor.subtract(1, 'day')
    }
}

async function getReviewedDatesWithin({
    userId,
    startDate,
    endDate,
}: {
    userId: string
    startDate: string
    endDate: string
}) {
    const rows = await listFlashbacksWithin({ userId, startDate, endDate })
    return getReviewedDates(rows)
}

function getReviewedDates(rows: FlashbackReviewProgress[]) {
    const reviewedDates = new Set<string>()
    for (const row of rows) {
        if (reviewedDates.has(row.date)) {
            continue
        }

        if (isLanguageReviewCompleted(row)) {
            reviewedDates.add(row.date)
        }
    }

    return reviewedDates
}

function isLanguageReviewCompleted(row: FlashbackReviewProgress) {
    const completion = getReviewCompletion({
        story: row.story,
        translations: row.translations,
        conversation: row.conversation,
    })

    return completion.percentage >= REVIEW_STREAK_THRESHOLD
}
