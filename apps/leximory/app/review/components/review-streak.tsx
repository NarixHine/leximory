'use client'

import { motion } from 'framer-motion'
import { PiCheckCircleFill } from 'react-icons/pi'
import { cn } from '@/lib/utils'
import type { ReviewStreakData } from '../data'

interface ReviewStreakProps {
    streak: ReviewStreakData
}

export function ReviewStreak({ streak }: ReviewStreakProps) {
    return (
        <section className="relative isolate overflow-hidden rounded-2xl bg-default-900 text-white">
            <div
                aria-hidden
                className="absolute inset-0 -z-20 bg-cover bg-center brightness-85"
                style={{ backgroundImage: 'url(/assets/cat-lawn.webp)' }}
            />

            <div className="relative flex flex-col justify-between gap-7 p-6 sm:flex-row sm:items-end sm:gap-8 sm:p-8">
                <div className="min-w-0">
                    <p className="font-ui font-bold text-2xl tracking-normal sm:text-2xl">
                        连续打卡
                    </p>
                    <div className="flex items-end gap-2 sm:mt-3">
                        <motion.span
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                            className="text-4xl font-formal leading-[0.86] tracking-normal sm:text-7xl"
                        >
                            {streak.total}
                        </motion.span>
                        <span className="font-ui text-3xl font-black sm:text-3xl">
                            天
                        </span>
                    </div>
                </div>

                <div
                    className="grid w-52 grid-cols-4 gap-2 self-end"
                    aria-label={`连续打卡 ${streak.total} 天`}
                >
                    {streak.checkDays.map((day, index) => (
                        <motion.div
                            key={day.date}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.035, duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            className={cn(
                                'grid size-11 place-items-center rounded-full transition-opacity sm:size-12'
                            )}
                        >
                            <PiCheckCircleFill className={cn('size-full', day.completed ? 'text-white' : 'text-white/50')} />
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
