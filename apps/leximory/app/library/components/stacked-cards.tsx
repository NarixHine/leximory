'use client'

import { ReactNode, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export type BgTheme = 'forest' | 'idyll' | 'lake' | 'night'

export const themeImages: Record<BgTheme, string> = {
    forest: '/images/forest.webp',
    idyll: '/images/idyll.webp',
    lake: '/images/lake.webp',
    night: '/images/night.webp',
}

export const themeOverlayClasses: Record<BgTheme, string> = {
    forest: 'bg-linear-to-b from-black/50 via-black/20 to-black/50',
    idyll: 'bg-linear-to-b from-black/40 via-black/20 to-black/40',
    lake: 'bg-black/20',
    night: 'bg-black/1', // already dark enough
}

interface StackedCardsProps {
    themes: BgTheme[]
    defaultTheme: BgTheme
    themeImages: Record<BgTheme, string>
    themeOverlayClasses?: Record<BgTheme, string>
    selectedRef?: React.RefObject<HTMLDivElement | null>
    children: (theme: BgTheme, isSelected: boolean) => ReactNode
    onThemeSelect?: (theme: BgTheme) => void
}

export function StackedCards({
    themes,
    defaultTheme,
    themeImages,
    themeOverlayClasses,
    selectedRef,
    children,
    onThemeSelect,
}: StackedCardsProps) {
    const [selectedTheme, setSelectedTheme] = useState<BgTheme>(defaultTheme)
    const currentIndex = themes.indexOf(selectedTheme)

    const handleThemeSelect = (theme: BgTheme) => {
        if (theme !== selectedTheme) {
            setSelectedTheme(theme)
            onThemeSelect?.(theme)
        }
    }

    const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
        const swipeThreshold = 50
        const swipeVelocity = 500

        if (info.offset.x < -swipeThreshold || info.velocity.x < -swipeVelocity) {
            const nextIndex = Math.min(currentIndex + 1, themes.length - 1)
            if (nextIndex !== currentIndex) {
                setSelectedTheme(themes[nextIndex])
                onThemeSelect?.(themes[nextIndex])
            }
        } else if (info.offset.x > swipeThreshold || info.velocity.x > swipeVelocity) {
            const prevIndex = Math.max(currentIndex - 1, 0)
            if (prevIndex !== currentIndex) {
                setSelectedTheme(themes[prevIndex])
                onThemeSelect?.(themes[prevIndex])
            }
        }
    }

    return (
        <div className='absolute inset-0 flex items-center justify-center'>
            {themes.map((theme, index) => {
                const offset = index - currentIndex
                const isSelected = theme === selectedTheme
                const isLeft = offset < 0

                return (
                    <motion.div
                        key={theme}
                        className={cn('absolute', isSelected ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer')}
                        initial={false}
                        animate={{
                            x: isSelected ? 0 : isLeft ? -80 : 80,
                            y: isSelected ? 0 : 10,
                            scale: isSelected ? 1 : 0.85,
                            zIndex: isSelected ? 10 : 5 - Math.abs(offset),
                            opacity: 1,
                            rotate: isSelected ? 0 : isLeft ? -8 : 8,
                        }}
                        transition={{
                            type: 'spring',
                            stiffness: 300,
                            damping: 25,
                            mass: 0.8,
                        }}
                        drag={isSelected ? 'x' : false}
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.7}
                        onDragEnd={handleDragEnd}
                        onClick={() => !isSelected && handleThemeSelect(theme)}
                    >
                        <div
                            ref={isSelected ? selectedRef : undefined}
                            className='relative w-95 h-full overflow-hidden rounded-none shadow-2xl bg-black/85 border border-white/50'
                        >
                            <motion.img
                                src={themeImages[theme]}
                                alt=''
                                className='absolute inset-0 w-full h-full object-cover'
                            />
                            {themeOverlayClasses?.[theme] && (
                                <div className={cn('absolute inset-0', themeOverlayClasses[theme])} />
                            )}
                            <div className='relative h-full flex flex-col px-8 pb-4 pt-5 z-10'>
                                {children(theme, isSelected)}
                            </div>
                        </div>
                    </motion.div>
                )
            })}
        </div>
    )
}

interface CardModalProps {
    isOpen: boolean
    onClose: () => void
    children: ReactNode
}

export function CardModal({ onClose, children }: CardModalProps) {
    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className='fixed inset-0 z-50 bg-default-200/50 backdrop-blur-lg'
                onClick={onClose}
            />
            <div className='fixed inset-0 pb-15 z-50 flex items-center justify-center p-4'>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className='relative w-95 min-h-150'
                    onClick={(e) => e.stopPropagation()}
                >
                    {children}
                </motion.div>
            </div>
        </>
    )
}
