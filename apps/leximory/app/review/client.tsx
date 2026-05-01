'use client'

import { type ReactNode, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Timeline } from './components/timeline'
import { ReviewFlow } from './components/review-flow'
import Main from '@/components/ui/main'
import type { DayData } from './data'
import { Lang } from '@repo/env/config'

interface SelectedReviewDay {
    date: string
    lang: Lang
}

interface ExperimentClientProps {
    days: DayData[]
    Header: ReactNode
}

export default function ExperimentClient({ days, Header }: ExperimentClientProps) {
    const [selectedDay, setSelectedDay] = useState<SelectedReviewDay | null>(null)

    const handleReviewClick = (day: DayData, lang: Lang) => {
        setSelectedDay({
            date: day.date,
            lang,
        })
    }

    const handleExitReview = () => {
        setSelectedDay(null)
    }

    return (
        <Main>
            <AnimatePresence mode='sync'>
                {!selectedDay ? (
                    <motion.div
                        key="timeline"
                        initial={{ opacity: 1, y: 0 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 30 }}
                        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="max-w-2xl mx-auto pb-10"
                    >
                        {/* Title */}
                        {Header}

                        {/* Timeline */}
                        <Timeline
                            days={days}
                            onReviewClick={handleReviewClick}
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        key="review"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="fixed inset-0 z-50 bg-background"
                    >
                        <ReviewFlow
                            date={selectedDay.date}
                            lang={selectedDay.lang}
                            onExit={handleExitReview}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </Main>
    )
}
