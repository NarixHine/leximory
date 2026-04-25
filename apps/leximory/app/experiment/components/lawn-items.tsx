'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { PiBookOpen } from 'react-icons/pi'

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
    shouldAnimate?: boolean
}

export function WordPill({ id, x, y, delay = 0, onClick, word, isCompleted = false, shouldAnimate = true }: WordPillProps) {
    return (
        <motion.button
            id={id}
            initial={shouldAnimate ? { opacity: 0, scale: 0 } : false}
            animate={{ opacity: isCompleted ? 0.62 : 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{
                delay,
                type: 'spring',
                stiffness: 300,
                damping: 20
            }}
            whileHover={{ scale: isCompleted ? 1.03 : 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            className={cn(
                "absolute px-3 py-1.5 text-sm font-medium rounded-full font-mono overflow-hidden",
                "duration-200 transition-opacity",
                "cursor-pointer select-none",
                'bg-default-50 px-3 py-1 border-3 border-default-200 rounded-4xl',
                isCompleted && 'border-default-300 bg-default-100/90 text-content1-foreground/50'
            )}
            style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
            }}
        >
            <span className="relative z-10">{word}</span>
            <motion.span
                aria-hidden
                initial={false}
                animate={{ scaleX: isCompleted ? 1 : 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="absolute left-2 right-2 top-1/2 z-20 h-0.5 -translate-y-1/2 origin-left rounded-full bg-primary-400"
            />
        </motion.button>
    )
}

interface StoryPillProps extends LawnItemProps {
    onClick?: () => void
    isActive?: boolean
    shouldAnimate?: boolean
}

export function StoryPill({ id, x, y, delay = 0, onClick, shouldAnimate = true }: StoryPillProps) {
    return (
        <motion.button
            id={id}
            initial={shouldAnimate ? { opacity: 0, scale: 0 } : false}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{
                delay,
                type: 'spring',
                stiffness: 300,
                damping: 20
            }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            className={cn(
                "absolute px-4 py-2 text-sm font-medium rounded-full font-kaiti",
                "flex items-center gap-2",
                "transition-colors duration-200",
                "cursor-pointer select-none",
                'bg-default-50 px-3 py-1 border-3 border-default-200 rounded-4xl'
            )}
            style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
            }}
        >
            <PiBookOpen className="w-4 h-4" />
            <span>连词成文</span>
        </motion.button>
    )
}
