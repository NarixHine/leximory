'use client'

import { cn } from '@/lib/utils'
import Comment from '@/components/comment'
import { AreaChart } from '@/components/ui/area-chart'
import type { DayData } from '../data'
import { parseWord } from '@repo/utils'
import { momentSH } from '@/lib/moment'

interface TimelineProps {
    days: DayData[]
    maxCount: number
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function Timeline({ days }: TimelineProps) {
    // Filter out days with no words
    const daysWithWords = days.filter(day => day.words.length > 0)

    const chartData = days.map(day => ({
        date: day.displayDate,
        '词汇': day.count
    })).reverse()

    return (
        <div className="space-y-10">
            {/* Chart at top */}
            <div className="space-y-4">
                <AreaChart
                    data={chartData}
                    index="date"
                    categories={['词汇']}
                    colors={['primary']}
                    showLegend={false}
                    startEndOnly
                    showGridLines={false}
                    allowDecimals={false}
                    className="h-28"
                />
            </div>

            {/* Timeline */}
            <div className="relative">
                {/* Rows */}
                <div className="space-y-4">
                    {daysWithWords.map((day, index) => (
                        <TimelineRow
                            key={day.date}
                            day={day}
                            isToday={index === 0}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

function TimelineRow({ day, isToday }: { day: DayData; isToday: boolean }) {
    const dateObj = new Date(day.date)
    const weekday = WEEKDAYS[dateObj.getDay()]
    const dateNum = dateObj.getDate()

    if (isToday) {
        return <TodayRow day={day} weekday={weekday} dateNum={dateNum} />
    }

    return (
        <div className="group flex items-start gap-6 py-2">
            {/* Date - right aligned */}
            <div className="w-16 shrink-0 text-right pt-1">
                <div className="text-xs text-default-400">{momentSH(day.date).format('ddd')}</div>
                <div className="text-sm text-default-600 tabular-nums">{momentSH(day.date).format('MM/DD')}</div>
            </div>

            {/* Content - left aligned */}
            <div className="flex-1 min-w-0 space-y-2">
                {/* Words */}
                <div className="flex flex-wrap items-center gap-2">
                    {day.words.map((word) => (
                        <WordPill key={word.id} word={word.word} />
                    ))}
                </div>

                {/* Progress */}
                <DiscreteProgress value={day.progress} />
            </div>
        </div>
    )
}

function TodayRow({ day, weekday, dateNum }: { day: DayData; weekday: string; dateNum: number }) {
    return (
        <div className="relative -mx-4 my-2">
            <div className="bg-primary-50/60 rounded-2xl p-5 border border-primary-100/50">
                <div className="flex items-start gap-6">
                    {/* Date */}
                    <div className="w-16 shrink-0 text-right pt-1">
                        <div className="text-xs font-medium text-primary">{momentSH(day.date).format('ddd')}</div>
                        <div className="text-xl font-light text-primary tabular-nums">{momentSH(day.date).format('MM/DD')}</div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-3">
                        <p className="text-sm font-medium text-default-700">
                            今日 {day.words.length} 词
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                            {day.words.map((word) => (
                                <WordPill key={word.id} word={word.word} isToday />
                            ))}
                        </div>

                        <DiscreteProgress value={day.progress} />
                    </div>
                </div>
            </div>
        </div>
    )
}

function WordPill({ word, isToday }: { word: string; isToday?: boolean }) {
    const cleanWord = extractWord(word)
    const params = encodeParams(word)

    return (
        <Comment
            params={params}
            disableSave
            onlyComments
            trigger={{
                className: cn(
                    isToday ? 'text-lg' : 'text-sm',
                ),
                variant: 'flat',
                color: 'default',
                size: isToday ? 'md' : 'sm',
                radius: 'lg',
                children: parseWord(word)[0]
            }}
        >
            {cleanWord}
        </Comment>
    )
}

// 4-state progress: empty, 1/3, 2/3, full
function DiscreteProgress({ value }: { value: number }) {
    const state = value === 0 ? 0 : value < 34 ? 1 : value < 67 ? 2 : 3

    return (
        <div className="flex items-center gap-1">
            <div className={cn(
                "h-2 w-8 rounded-l transition-colors",
                state >= 1 ? "bg-default-400" : "bg-default-200"
            )} />
            <div className={cn(
                "h-2 w-8 rounded-none transition-colors",
                state >= 2 ? "bg-default-400" : "bg-default-200"
            )} />
            <div className={cn(
                "h-2 w-8 rounded-r transition-colors",
                state >= 3 ? "bg-default-400" : "bg-default-200"
            )} />
        </div>
    )
}

function extractWord(wordText: string): string {
    if (wordText.startsWith('{{') && wordText.includes('||')) {
        const inner = wordText.slice(2, -2)
        const parts = inner.split('||')
        return parts[0]?.trim() || wordText
    }
    return wordText.trim().split(/\s+/)[0]
}

function encodeParams(wordText: string): string[] {
    if (wordText.startsWith('{{') && wordText.includes('||')) {
        const inner = wordText.slice(2, -2)
        const parts = inner.split('||')
        return parts.map(p => encodeURIComponent(p.trim()))
    }
    return [encodeURIComponent(wordText.trim())]
}
