'use client'

import { cn } from '@/lib/utils'
import { AreaChart } from '@/components/ui/area-chart'
import type { DayData } from '../data'
import { momentSH } from '@/lib/moment'
import Comment from '@/components/comment'
import { ScopeProvider } from 'jotai-scope'
import { HydrationBoundary } from 'jotai-ssr'
import { useAtomValue } from 'jotai'
import { langAtom } from '@/app/library/[lib]/atoms'
import { Lang } from '@repo/env/config'
import { DiscreteProgress } from './discrete-progress'
import { reviewProgressFamily } from '../atoms'

interface TimelineProps {
    days: DayData[]
    onReviewClick: (day: DayData, lang: Lang) => void
}

export function Timeline({ days, onReviewClick }: TimelineProps) {
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
                <div className="space-y-4">
                    {days.map((day) => (
                        <TimelineRow
                            key={day.date}
                            day={day}
                            isToday={day.isToday}
                            onReviewClick={(lang) => onReviewClick(day, lang)}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

function TimelineRow({ day, isToday, onReviewClick }: {
    day: DayData
    isToday: boolean
    onReviewClick: (lang: Lang) => void
}) {
    if (isToday) {
        return <TodayRow day={day} />
    }

    return (
        <div className="group flex items-start gap-6 py-2">
            <div className="w-10 sm:w-16 shrink-0 text-right pt-1">
                <div className="text-xs text-default-400">{momentSH(day.date).format('ddd')}</div>
                <div className="text-sm text-default-600 tabular-nums">{momentSH(day.date).format('MM/DD')}</div>
            </div>

            <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    {day.words.map((word) => (
                        <WordPill key={word.id} word={word.word} lang={word.lang} />
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {Object.entries(day.progressByLang).map(([lang, progress]) => (
                        <SyncedDiscreteProgress
                            key={lang}
                            date={day.date}
                            lang={lang as Lang}
                            progress={progress}
                            onClick={() => onReviewClick(lang as Lang)}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

function TodayRow({ day }: { day: DayData }) {
    return (
        <div className="relative -mx-4 my-2">
            <div className="bg-primary-50/60 rounded-2xl p-5 border border-primary-100/50">
                <div className="flex items-start gap-6">
                    <div className="w-16 shrink-0 text-right pt-1">
                        <div className="text-xs font-medium text-primary">{momentSH(day.date).format('ddd')}</div>
                        <div className="text-xl font-light text-primary tabular-nums">{momentSH(day.date).format('MM/DD')}</div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-3">
                        <p className="text-sm font-medium text-default-700">
                            今日 {day.words.length} 词
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                            {day.words.map((word) => (
                                <WordPill key={word.id} word={word.word} isToday lang={word.lang} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function WordPill({ word, isToday, lang }: { word: string; isToday?: boolean; lang?: string }) {
    // Pass the full word params directly to Comment - it already contains {{word||reading||definition}}
    const commentElement = (
        <Comment
            params={word}
            disableSave
            preset="pill"
            className={cn(
                isToday && 'text-lg'
            )}
        />
    )

    // If lang is provided, wrap in ScopeProvider to set the correct language
    if (lang) {
        return (
            <ScopeProvider atoms={[langAtom]}>
                <HydrationBoundary hydrateAtoms={[[langAtom, lang as Lang]]}>
                    {commentElement}
                </HydrationBoundary>
            </ScopeProvider>
        )
    }

    return commentElement
}

function SyncedDiscreteProgress({
    date,
    lang,
    progress,
    onClick,
}: {
    date: string
    lang: Lang
    progress: { percentage: number; conversationCompleted: boolean } | undefined
    onClick: () => void
}) {
    const atomProgress = useAtomValue(reviewProgressFamily(`${date}:${lang}`))

    const effectiveProgress = atomProgress ?? {
        percentage: progress?.percentage ?? 0,
        conversationCompleted: progress?.conversationCompleted ?? false,
    }

    return (
        <DiscreteProgress
            value={effectiveProgress.percentage}
            conversationCompleted={effectiveProgress.conversationCompleted}
            lang={lang}
            onClick={onClick}
        />
    )
}
