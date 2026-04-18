'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Timeline } from './components/timeline'
import { ReviewFlow } from './components/review-flow'
import { PiCaretLeft, PiCaretRight } from 'react-icons/pi'
import Main from '@/components/ui/main'
import type { DayData } from './data'

interface ExperimentClientProps {
    days: DayData[]
    maxCount: number
}

export default function ExperimentClient({ days, maxCount }: ExperimentClientProps) {
    const [selectedDay, setSelectedDay] = useState<DayData | null>(null)

    const handleReviewClick = (day: DayData) => {
        setSelectedDay(day)
    }

    const handleExitReview = () => {
        setSelectedDay(null)
    }

    const primaryLang = selectedDay?.words[0]?.lang || 'en'

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
                        className="max-w-2xl mx-auto px-6 py-10"
                    >
                        {/* Navigation */}
                        <nav className="flex items-center justify-between mb-10">
                            <div className="inline-flex items-center bg-default-100/60 rounded-full p-1">
                                <button className="p-2 rounded-full hover:bg-white transition-all text-default-400 hover:text-default-600">
                                    <PiCaretLeft className="w-4 h-4" />
                                </button>
                                <span className="text-sm font-medium text-default-700 px-3">4月</span>
                                <button className="p-2 rounded-full hover:bg-white transition-all text-default-400 hover:text-default-600">
                                    <PiCaretRight className="w-4 h-4" />
                                </button>
                            </div>
                        </nav>

                        {/* Title */}
                        <header className="mb-10">
                            <h1 className="text-4xl sm:text-5xl font-serif font-normal text-default-800 tracking-tight">
                                Apr &rsquo;26
                            </h1>
                        </header>

                        {/* Timeline */}
                        <Timeline
                            days={days}
                            maxCount={maxCount}
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
