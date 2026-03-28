'use client'

import { ReactNode, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export type BgTheme = 'forest' | 'idyll' | 'lake'

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

    return (
        <div className='absolute inset-0 flex items-center justify-center'>
            {themes.map((theme, index) => {
                const offset = index - currentIndex
                const isSelected = theme === selectedTheme
                const isLeft = offset < 0

                return (
                    <motion.div
                        key={theme}
                        className={cn('absolute', isSelected ? 'pointer-events-none' : 'cursor-pointer')}
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
                        onClick={() => handleThemeSelect(theme)}
                    >
                        <div
                            ref={isSelected ? selectedRef : undefined}
                            className='relative w-95 h-150 overflow-hidden rounded-none shadow-2xl bg-black/85 border border-white/50'
                        >
                            <motion.img
                                src={themeImages[theme]}
                                alt=''
                                className='absolute inset-0 w-full h-full object-cover opacity-70'
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
                    className='relative w-95 h-150'
                    onClick={(e) => e.stopPropagation()}
                >
                    {children}
                </motion.div>
            </div>
        </>
    )
}
