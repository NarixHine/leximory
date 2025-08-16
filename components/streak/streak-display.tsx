'use client'

import { Card, CardBody } from '@heroui/card'
import { PiFireFill, PiCheckBold, PiCursorClickDuotone, PiCircle, PiCheckCircle } from 'react-icons/pi'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import Link from 'next/link'
import moment from 'moment'

type StreakData = {
    total: number
    history: {
        date: string
        active: boolean
    }[]
    highest: number
}

export function StreakDisplay({ streakData, compact = false }: { streakData: StreakData, compact?: boolean }) {
    const todayEntry = streakData.history.find(entry => moment(entry.date).isSame(moment(), 'day'))
    const isTodayActive = todayEntry?.active || false

    if (compact) {
        return (
            <Card
                shadow='none'
                fullWidth
                isPressable
                as={Link}
                href='/memories'
                className='bg-orange-100/50 dark:bg-orange-900/20 border-none'
            >
                <CardBody className='p-4'>
                    <div className='flex items-center justify-center gap-4'>
                        <p className='text-xl font-bold text-orange-600 dark:text-orange-400 flex items-center gap-2'><PiFireFill className='text-2xl text-orange-500' /> {streakData.total}</p>
                        <div className='flex items-center gap-1 text-red-400'>
                            <span className='text-sm font-mono'>Today:</span>
                            <span className='text-lg'>{isTodayActive ? <PiCheckCircle /> : <PiCircle />}</span>
                        </div>
                    </div>
                </CardBody>
            </Card>
        )
    }

    return (
        <Card shadow='none' fullWidth isPressable as={Link} href='/memories' className='bg-orange-100/50 dark:bg-orange-900/20 border-none'>
            <CardBody className='p-8 pb-4 relative'>
                <PiCursorClickDuotone className='absolute top-4 right-4 text-orange-500 z-1' />
                <div className='flex items-center justify-center gap-4'>
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{
                            scale: 1,
                            opacity: 1,
                            rotate: [0, -5, 5, -5, 0],
                            scaleX: [1, 1.05, 0.95, 1.05, 1]
                        }}
                        transition={{
                            duration: 0.7,
                            ease: 'easeInOut',
                        }}
                    >
                        <PiFireFill className='text-7xl text-orange-500' />
                    </motion.div>
                    <div>
                        <p className='text-5xl font-bold text-orange-600 dark:text-orange-400 font-ui'>{streakData.total}</p>
                        <p className={'text-sm text-orange-500 dark:text-orange-300 text-semibold font-mono'}>Day Streak</p>
                    </div>
                </div>
                {streakData.history.length > 0 && <div className='grid grid-cols-4 max-w-md mx-auto sm:max-w-full sm:grid-cols-8 gap-3 mt-4'>
                    {streakData.history.map(({ date, active }, i) => (
                        <motion.div
                            key={date}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className='flex flex-col items-center gap-2'
                        >
                            <div
                                className={cn(
                                    'size-10 rounded-full flex items-center justify-center transition-colors',
                                    active ? 'bg-orange-400' : 'bg-orange-200/50 dark:bg-orange-800/30'
                                )}
                            >
                                {active && <PiCheckBold className='text-white' />}
                            </div>
                            <p className={cn('text-xs font-mono text-orange-500/80 dark:text-orange-300/80')}>{new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</p>
                        </motion.div>
                    ))}
                </div>}
                <p className={'text-xs text-orange-500/80 dark:text-orange-300/80 font-mono text-center mt-4'}>Historic high: {streakData.highest}</p>
            </CardBody>
        </Card>
    )
}
