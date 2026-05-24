'use client'

import { motion } from 'framer-motion'
import { PiCheckCircleFill, PiCircleThin } from 'react-icons/pi'
import { cn } from '@/lib/utils'
import type { ReviewStreakData } from '../data'

interface ReviewStreakProps {
    streak: ReviewStreakData
}

export function ReviewStreak({ streak }: ReviewStreakProps) {
    return (
        <section className="relative isolate overflow-hidden rounded-2xl text-default-700">
            <div className="relative flex flex-wrap flex-row items-end space-x-4 gap-2">
                <div className="min-w-0">
                    <p className="font-kaiti text-xl tracking-normal text-secondary-400">
                        连续打卡 <motion.span
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                            className="text-default-600 font-fancy text-3xl"
                        >
                            {streak.total}
                        </motion.span> 天
                    </p>
                </div>

                <div
                    className="flex gap-0 self-end"
                    aria-label={`连续打卡 ${streak.total} 天`}
                >
                    {streak.checkDays.map((day) => (
                        <div
                            key={day.date}
                            className={cn(
                                'grid size-8 place-items-center rounded-full'
                            )}
                        >
                            {
                                day.completed
                                    ? <PiCheckCircleFill className={cn('size-full text-default-400')} />
                                    : <PiCircleThin className={cn('size-full text-default-300')} />
                            }
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export function ReviewStreakSkeleton() {
    return (
        <section className="relative isolate overflow-hidden rounded-2xl text-default-700">
            <div className="relative flex flex-wrap flex-row items-end space-x-4 gap-2">
                <div className="min-w-0">
                    <p className="font-kaiti text-xl tracking-normal text-secondary-300/70">
                        连续打卡 <span className="inline-block h-7.25 w-10 translate-y-1 rounded-md bg-default-200/80 align-baseline animate-pulse" /> 天
                    </p>
                </div>

                <div
                    className="flex gap-0 self-end"
                    aria-label="正在加载连续打卡"
                    aria-busy="true"
                >
                    {Array.from({ length: 7 }, (_, index) => (
                        <div
                            key={index}
                            className="grid size-8 place-items-center rounded-full"
                        >
                            <div className="size-7 rounded-full bg-default-200/50 animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
