'use client'

import { Card, CardBody } from '@heroui/react'
import { PiFireFill, PiCheckBold } from 'react-icons/pi'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { ENGLISH_FANCY } from '@/lib/fonts'
import { useRouter } from 'next/navigation'

type StreakData = {
    total: number
    history: {
        date: string
        active: boolean
    }[]
}

export function StreakDisplay({ streakData }: { streakData: StreakData }) {
    const router = useRouter()
    return (
        <Card shadow='none' fullWidth isPressable onPress={() => {
            router.push('/memories')
        }} className='bg-orange-100/50 dark:bg-orange-900/20 border-none'>
            <CardBody className='p-8'>
                <div className='flex items-center justify-center gap-4'>
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    >
                        <PiFireFill className='text-7xl text-orange-500' />
                    </motion.div>
                    <div>
                        <p className='text-5xl font-bold text-orange-600 dark:text-orange-400'>{streakData.total}</p>
                        <p className={cn('text-sm text-orange-500 dark:text-orange-300', ENGLISH_FANCY.className)}>Day Streak</p>
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
                            <p className={cn('text-xs text-orange-500/80 dark:text-orange-300/80')}>{new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</p>
                        </motion.div>
                    ))}
                </div>}
            </CardBody>
        </Card>
    )
}