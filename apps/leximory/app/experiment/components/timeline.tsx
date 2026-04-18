'use client'

import { cn } from '@/lib/utils'
import { AreaChart } from '@/components/ui/area-chart'
import type { DayData } from '../data'
import { momentSH } from '@/lib/moment'
import { PiCursorClick, PiCalendarCheck } from 'react-icons/pi'
import Comment from '@/components/comment'
import { ScopeProvider } from 'jotai-scope'
import { HydrationBoundary } from 'jotai-ssr'
import { langAtom } from '@/app/library/[lib]/atoms'
import { Lang } from '@repo/env/config'

interface TimelineProps {
    days: DayData[]
    maxCount: number
    onReviewClick: (day: DayData) => void
}

export function Timeline({ days, onReviewClick }: TimelineProps) {
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
                <div className="space-y-4">
                    {daysWithWords.map((day, index) => (
                        <TimelineRow
                            key={day.date}
                            day={day}
                            isToday={index === 0}
                            onReviewClick={() => onReviewClick(day)}
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
    onReviewClick: () => void 
}) {
    if (isToday) {
        return <TodayRow day={day} onReviewClick={onReviewClick} />
    }

    return (
        <div className="group flex items-start gap-6 py-2">
            <div className="w-16 shrink-0 text-right pt-1">
                <div className="text-xs text-default-400">{momentSH(day.date).format('ddd')}</div>
                <div className="text-sm text-default-600 tabular-nums">{momentSH(day.date).format('MM/DD')}</div>
            </div>

                <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    {day.words.map((word) => (
                        <WordPill key={word.id} word={word.word} lang={word.lang} />
                    ))}
                </div>

                <DiscreteProgress 
                    value={day.progress} 
                    onClick={onReviewClick}
                />
            </div>
        </div>
    )
}

function TodayRow({ day, onReviewClick }: { day: DayData; onReviewClick: () => void }) {
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
                        
                        <DiscreteProgress 
                            value={day.progress} 
                            onClick={onReviewClick}
                        />
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

function DiscreteProgress({ value, onClick }: { value: number; onClick?: () => void }) {
    const state = value === 0 ? 0 : value < 34 ? 1 : value < 67 ? 2 : 3
    const isCompleted = state === 3

    return (
        <button 
            onClick={onClick}
            className="flex items-center gap-2 group cursor-pointer"
        >
            <div className="flex items-center gap-0.5">
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
            {isCompleted ? (
                <PiCalendarCheck className="w-4 h-4 text-primary" />
            ) : (
                <PiCursorClick className="w-4 h-4 text-default-300 group-hover:text-default-400 transition-colors" />
            )}
        </button>
    )
}


