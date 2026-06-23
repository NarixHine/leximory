'use client'

import { type ReactNode, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useIntersectionObserver } from 'usehooks-ts'
import { Spinner } from '@heroui/spinner'
import { Timeline } from './components/timeline'
import { ReviewFlow } from './components/review-flow'
import { loadMoreTimelineDays } from './components/actions'
import type { DayData } from './data'
import { Lang } from '@repo/env/config'
import type { ReviewProgressData } from './atoms'

interface SelectedReviewDay {
    date: string
    lang: Lang
}

interface ExperimentClientProps {
    initialDays: DayData[]
    initialNextCursor: string | undefined
    streakSlot: ReactNode
}

export default function ExperimentClient({
    initialDays,
    initialNextCursor,
    streakSlot,
}: ExperimentClientProps) {
    const [selectedDay, setSelectedDay] = useState<SelectedReviewDay | null>(null)
    const [progressOverrides, setProgressOverrides] = useState<Record<string, ReviewProgressData>>(
        {},
    )

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['review-timeline'],
        queryFn: async ({ pageParam }) => {
            return await loadMoreTimelineDays(pageParam)
        },
        initialPageParam: undefined as string | undefined,
        initialData: {
            pages: [{ days: initialDays, nextCursor: initialNextCursor }],
            pageParams: [undefined],
        },
        getNextPageParam: lastPage => lastPage?.nextCursor ?? undefined,
        staleTime: Infinity,
    })

    const days = data.pages.flatMap(page => page.days)

    const { ref: sentinelRef } = useIntersectionObserver({
        threshold: 0.1,
        onChange: isIntersecting => {
            if (isIntersecting && hasNextPage && !isFetchingNextPage) {
                fetchNextPage()
            }
        },
    })

    const handleReviewClick = (day: DayData, lang: Lang) => {
        setSelectedDay({
            date: day.date,
            lang,
        })
    }

    const handleExitReview = (progress: ReviewProgressData) => {
        if (selectedDay) {
            setProgressOverrides(current => ({
                ...current,
                [`${selectedDay.date}:${selectedDay.lang}`]: progress,
            }))
        }
        setSelectedDay(null)
    }

    return (
        <AnimatePresence mode='sync'>
            {!selectedDay ? (
                <motion.div
                    key='timeline'
                    initial={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className='pb-10'
                >
                    <Timeline
                        days={days}
                        streakSlot={streakSlot}
                        progressOverrides={progressOverrides}
                        onReviewClick={handleReviewClick}
                    />
                    {hasNextPage && (
                        <div ref={sentinelRef} className='flex justify-center py-6'>
                            {isFetchingNextPage ? <Spinner size='lg' variant='simple' /> : null}
                        </div>
                    )}
                </motion.div>
            ) : (
                <motion.div
                    key='review'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className='fixed inset-0 z-51 bg-background'
                >
                    <ReviewFlow
                        date={selectedDay.date}
                        lang={selectedDay.lang}
                        onExit={handleExitReview}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    )
}
