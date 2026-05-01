'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { PiLockKey, PiSparkleFill, PiBookOpen } from 'react-icons/pi'
import { CAT_FRAME_ASPECT, CatSprite } from './cat-sprite'

interface LawnItemProps {
    id: string
    x: number
    y: number
    delay?: number
    onClick?: () => void
    isActive?: boolean
}

interface WordPillProps extends LawnItemProps {
    word: string
    isCompleted?: boolean
}

export function WordPill({ id, x, y, delay = 0, onClick, word, isCompleted = false }: WordPillProps) {
    return (
        <motion.div
            id={id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{
                delay,
                type: 'spring',
                stiffness: 300,
                damping: 20
            }}
            className="absolute"
            style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
            }}
        >
            <motion.button
                whileHover={{ scale: isCompleted ? 1.03 : 1.08 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClick}
                className={cn(
                    "relative px-3 py-1.5 text-sm font-medium rounded-full font-mono overflow-hidden",
                    "duration-200 transition-opacity",
                    "cursor-pointer select-none",
                    'bg-default-50 px-3 py-1 border-3 border-default-200 rounded-4xl',
                    isCompleted && 'opacity-60 border-default-300 bg-default-100/90 text-content1-foreground/50'
                )}
            >
                <span className="relative z-10 text-nowrap truncate block max-w-50">{word}</span>
                <motion.span
                    aria-hidden
                    initial={false}
                    animate={{ scaleX: isCompleted ? 1 : 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute left-2 right-2 top-1/2 z-20 h-0.5 -translate-y-1/2 origin-left rounded-full bg-primary-400"
                />
            </motion.button>
        </motion.div>
    )
}

interface StoryPillProps extends LawnItemProps {
    onClick?: () => void
    isActive?: boolean
}

interface CatTaskPillProps extends LawnItemProps {
    isLocked?: boolean
    isCompleted?: boolean
}

export function StoryPill({ id, x, y, delay = 0, onClick }: StoryPillProps) {
    return (
        <motion.div
            id={id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{
                delay,
                type: 'spring',
                stiffness: 300,
                damping: 20
            }}
            className="absolute"
            style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
            }}
        >
            <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClick}
                className={cn(
                    "px-4 py-2 text-sm font-medium rounded-full font-kaiti",
                    "flex items-center gap-2",
                    "transition-colors duration-200",
                    "cursor-pointer select-none",
                    'bg-default-50 px-3 py-1 border-3 border-default-200 rounded-4xl'
                )}
            >
                <PiBookOpen className="w-4 h-4" />
                <span>连词成文</span>
            </motion.button>
        </motion.div>
    )
}

export function CatTaskPill({
    id,
    x,
    y,
    delay = 0,
    onClick,
    isLocked = false,
    isCompleted = false,
}: CatTaskPillProps) {
    const catHeightRem = 3.5
    const catWidthRem = catHeightRem * CAT_FRAME_ASPECT

    return (
        <motion.div
            id={id}
            initial={{ opacity: 0, scale: 1, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 12 }}
            transition={{ delay, type: 'spring', stiffness: 280, damping: 24 }}
            className="absolute"
            style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
            }}
        >
            <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onClick}
                className='group relative cursor-pointer select-none'
            >
                <div
                    className='relative'
                    style={{
                        height: `${catHeightRem}rem`,
                        width: `${catWidthRem}rem`,
                    }}
                >
                    <div className='absolute inset-0'>
                        <CatSprite variant='black' frame='idle' />
                    </div>
                </div>
            </motion.button>
        </motion.div>
    )
}
