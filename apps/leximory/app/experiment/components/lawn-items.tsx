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
}

export function WordPill({ id, x, y, delay = 0, onClick, word }: WordPillProps) {
    return (
        <motion.button
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
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            className={cn(
                "absolute px-3 py-1.5 text-sm font-medium rounded-full font-mono",
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
            {word}
        </motion.button>
    )
}

interface StoryPillProps extends LawnItemProps {
    onClick?: () => void
    isActive?: boolean
}

export function StoryPill({ id, x, y, delay = 0, onClick }: StoryPillProps) {
    return (
        <motion.button
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
