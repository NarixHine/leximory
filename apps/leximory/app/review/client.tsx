'use client'

import { Suspense, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Timeline } from './components/timeline'
import { ReviewFlow } from './components/review-flow'
import { PiCaretLeft, PiCaretRight } from 'react-icons/pi'
import Main from '@/components/ui/main'
import type { DayData } from './data'
import { momentSH } from '@/lib/moment'

interface ExperimentClientProps {
    days: DayData[]
}

export default function ExperimentClient({ days }: ExperimentClientProps) {
    const [selectedDay, setSelectedDay] = useState<DayData | null>(null)

    const handleReviewClick = (day: DayData) => {
        setSelectedDay(day)
    }

    const handleExitReview = () => {
        setSelectedDay(null)
    }

    const primaryLang = selectedDay?.words[0]?.lang || 'en'

    return (
        <Main className='pt-4 sm:pt-8'>
            <AnimatePresence mode='sync'>
                {!selectedDay ? (
                    <motion.div
                        key="timeline"
                        initial={{ opacity: 1, y: 0 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 30 }}
                        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="max-w-2xl mx-auto px-6 py-10"
                    >
                        {/* Title */}
                        <header className="mb-4 sm:mb-8">
                            <h1 className="text-4xl sm:text-5xl font-serif font-normal text-default-800 tracking-tight">
                                <Suspense>
                                    {momentSH().locale(primaryLang).format('MMM’ DD')}
                                </Suspense>
                            </h1>
                        </header>

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
                            lang={primaryLang}
                            onExit={handleExitReview}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </Main>
    )
}
