'use client'

import { cn } from '@/lib/utils'
import { AreaChart } from '@/components/ui/area-chart'
import { momentSH } from '@/lib/moment'
import Comment from '@/components/comment'
import { ScopeProvider } from 'jotai-scope'
import { HydrationBoundary } from 'jotai-ssr'
import { langAtom } from '@/app/library/[lib]/atoms'
import { Lang } from '@repo/env/config'
import { DiscreteProgress } from './discrete-progress'
import type { ReactNode } from 'react'
import type { DayData } from '../data'
import type { ReviewProgressData } from '../atoms'

interface TimelineProps {
    days: DayData[]
    streakSlot: ReactNode
    progressOverrides: Record<string, ReviewProgressData>
    onReviewClick: (day: DayData, lang: Lang) => void
}

export function Timeline({ days, streakSlot, progressOverrides, onReviewClick }: TimelineProps) {
    const chartData = days
        .map(day => ({
            date: day.displayDate,
            词汇: day.count,
        }))
        .reverse()

    return (
        <div className='space-y-6'>
            <div className='space-y-4 flex flex-col items-center'>
                <AreaChart
                    data={chartData}
                    index='date'
                    categories={['词汇']}
                    colors={['primary']}
                    showLegend={false}
                    startEndOnly
                    showGridLines={false}
                    allowDecimals={false}
                    className='h-28'
                />
                {streakSlot}
            </div>

            {/* Timeline */}
            <div className='relative'>
                <div className='space-y-4'>
                    {days.map(day => (
                        <TimelineRow
                            key={day.date}
                            day={day}
                            isToday={day.isToday}
                            progressOverrides={progressOverrides}
                            onReviewClick={lang => onReviewClick(day, lang)}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

function TimelineRow({
    day,
    isToday,
    progressOverrides,
    onReviewClick,
}: {
    day: DayData
    isToday: boolean
    progressOverrides: Record<string, ReviewProgressData>
    onReviewClick: (lang: Lang) => void
}) {
    if (isToday) {
        return <TodayRow day={day} />
    }

    return (
        <div className='group flex items-start gap-6 py-2'>
            <div className='w-10 sm:w-16 shrink-0 text-right pt-1'>
                <div className='text-xs text-default-400'>{momentSH(day.date).format('ddd')}</div>
                <div className='text-sm text-default-600 tabular-nums'>
                    {momentSH(day.date).format('MM/DD')}
                </div>
            </div>

            <div className='flex-1 min-w-0 space-y-2'>
                <div className='flex flex-wrap items-center gap-2'>
                    {day.words.map(word => (
                        <WordPill
                            deleteId={word.id}
                            key={word.id}
                            word={word.word}
                            lang={word.lang}
                        />
                    ))}
                </div>

                <div className='flex flex-wrap items-center space-x-3'>
                    {Object.entries(day.progressByLang).map(([lang, progress]) => (
                        <DiscreteProgress
                            key={lang}
                            value={
                                (progressOverrides[`${day.date}:${lang}`] ?? progress)
                                    ?.percentage ?? 0
                            }
                            conversationCompleted={
                                (progressOverrides[`${day.date}:${lang}`] ?? progress)
                                    ?.conversationCompleted ?? false
                            }
                            lang={lang as Lang}
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
        <div className='relative -mx-4 my-2'>
            <div className='bg-primary-50/60 rounded-2xl p-5 border border-primary-100/50'>
                <div className='flex items-start gap-6'>
                    <div className='w-16 shrink-0 text-right pt-1'>
                        <div className='text-xs font-medium text-primary'>
                            {momentSH(day.date).format('ddd')}
                        </div>
                        <div className='text-xl font-light text-primary tabular-nums'>
                            {momentSH(day.date).format('MM/DD')}
                        </div>
                    </div>

                    <div className='flex-1 min-w-0 space-y-3'>
                        <p className='text-sm font-medium text-default-700'>
                            今日 {day.words.length} 词
                        </p>

                        <div className='flex flex-wrap items-center gap-2'>
                            {day.words.map(word => (
                                <WordPill
                                    deleteId={word.id}
                                    key={word.id}
                                    word={word.word}
                                    isToday
                                    lang={word.lang}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function WordPill({
    word,
    isToday,
    deleteId,
    lang,
}: {
    word: string
    isToday?: boolean
    lang?: string
    deleteId: string
}) {
    // Pass the full word params directly to Comment - it already contains {{word||reading||definition}}
    const commentElement = (
        <Comment
            params={word}
            deleteId={deleteId}
            preset='pill'
            className={cn(isToday && 'text-lg')}
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
