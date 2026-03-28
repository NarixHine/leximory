'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { QRCodeSVG } from 'qrcode.react'
import { Lang } from '@repo/schema/library'
import { prefixUrl } from '@repo/env/config'
import { domToPng } from 'modern-screenshot'
import { useIsClient, useEventListener } from 'usehooks-ts'
import { cn } from '@/lib/utils'
import { EMOJI, GEIST_MONO } from '@/lib/fonts'
import { getLanguageStrategy } from '@/lib/languages'
import { toast } from 'sonner'

type BgTheme = 'forest' | 'idyll' | 'lake'

interface TextItem {
    emoji: string | null
    id: string
    title: string
}

interface LibraryCardProps {
    isOpen: boolean
    onClose: () => void
    libName: string
    creatorName: string
    lang: Lang
    libId: string
    texts?: TextItem[]
    bgTheme?: BgTheme
}

export function LibraryCard({ isOpen, onClose, libName, creatorName, lang, libId, texts, bgTheme = 'forest' }: LibraryCardProps) {
    const [isSaving, setIsSaving] = useState(false)
    const [selectedTheme, setSelectedTheme] = useState<BgTheme>(bgTheme)

    const themes: BgTheme[] = ['forest', 'idyll', 'lake']
    const currentIndex = themes.indexOf(selectedTheme)

    const themeImages: Record<BgTheme, string> = {
        forest: '/images/forest.webp',
        idyll: '/images/idyll.webp',
        lake: '/images/lake.webp',
    }
    const themeOverlayClasses: Record<BgTheme, string> = {
        forest: 'bg-black/35',
        idyll: 'bg-black/30',
        lake: 'bg-black/20',
    }

    const handleThemeSelect = (theme: BgTheme) => {
        if (theme !== selectedTheme) {
            setSelectedTheme(theme)
        }
    }
    const cardRef = useRef<HTMLDivElement>(null)
    const isClient = useIsClient()
    const strategy = getLanguageStrategy(lang)
    const learningWith = strategy.libraryCardLabels.learningWith
    const articleTitleFont = strategy.articleTitleFont


    useEventListener('keydown', (e: KeyboardEvent) => {
        if (isOpen && e.key === 'Escape') {
            onClose()
        }
    })

    const handleSaveImage = useCallback(async () => {
        if (!cardRef.current) return
        setIsSaving(true)
        try {
            const dataUrl = await domToPng(cardRef.current, { quality: 1, scale: 2 })
            const link = document.createElement('a')
            link.download = `leximory-${libName.replace(/\s+/g, '-').toLowerCase()}.png`
            link.href = dataUrl
            link.click()
        } catch {
            toast.error('保存失败')
        } finally {
            setIsSaving(false)
        }
    }, [libName])

    if (!isClient) return null

    const libUrl = prefixUrl(`/library/${libId}`)

    return (
        <AnimatePresence>
            {isOpen && (
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
                                                ref={isSelected ? cardRef : undefined}
                                                className={cn(
                                                    'relative w-95 h-150 overflow-hidden rounded-none shadow-2xl border border-black/30',
                                                )}>
                                                <Image src={themeImages[theme]} alt='' fill className={cn('object-cover opacity-100')} priority />

                                                {/*Dark Overlay for Legibility */}
                                                <div className={cn(
                                                    'absolute inset-0',
                                                    themeOverlayClasses[theme]
                                                )} />

                                                {/* Content */}
                                                <div className='relative h-full flex flex-col px-8 pb-4 pt-5 z-10'>
                                                    {/* Top: Creator Info */}
                                                    <div>
                                                        <h2 className={cn('font-fancy text-6xl tracking-tight text-white drop-shadow-md leading-tight -mb-2')}>
                                                            {creatorName}
                                                        </h2>
                                                        <p className='text-2xl text-balance font-sans tracking-tight font-semibold leading-tight text-shadow-lg mt-1'>
                                                            {learningWith}
                                                        </p>
                                                    </div>

                                                    <div className='bg-white/60 h-1 rounded-lg w-1/3 mt-4 mb-3'></div>

                                                    {/* Middle: Latest Articles */}
                                                    <div className='flex-1 flex flex-col justify-center space-y-1'>
                                                        {texts?.slice(0, 5).map((text) => (
                                                            <div
                                                                key={text.id}
                                                                className={`flex items-center gap-3`}
                                                            >
                                                                {/* Emoji Cover */}
                                                                <div className={cn(
                                                                    'shrink-0 w-12 h-12 text-white rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-2xl shadow-lg',
                                                                    EMOJI.className
                                                                )}>
                                                                    {text.emoji || '📄'}
                                                                </div>
                                                                {/* Title */}
                                                                <div className={`flex-1 min-w-0`}>
                                                                    <p className={cn(
                                                                        'text-medium text-balance text-white/90 leading-tight line-clamp-2 text-shadow-lg',
                                                                        articleTitleFont
                                                                    )}>
                                                                        {text.title}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {(!texts || texts.length === 0) && (
                                                            <div className='text-center text-white/50 font-sans text-sm italic'>
                                                                No articles yet
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className='bg-white/60 h-1 rounded-lg w-1/3 mt-3 mb-4'></div>

                                                    <div className='flex-1' />

                                                    {/* Bottom: The Sync Block */}
                                                    {/* We use a grid to ensure the QR (first col) matches the Title (second col) height perfectly */}
                                                    <div className='grid grid-cols-[0.3fr_1fr] gap-4 items-center w-full'>
                                                        <div className='h-full aspect-square flex items-center justify-start'>
                                                            <QRCodeSVG
                                                                value={libUrl}
                                                                style={{ width: '100%', height: '100%' }}
                                                                bgColor='transparent'
                                                                fgColor='#FFFFFF'
                                                                level='L'
                                                            />
                                                        </div>
                                                        <div className='flex justify-end w-full'>
                                                            <h1 className='font-fancy leading-9 tracking-tight text-balance text-right text-4xl text-white'>
                                                                {libName}
                                                            </h1>
                                                        </div>
                                                    </div>

                                                    <footer className='flex mt-3'>
                                                        <p className={cn(
                                                            'text-center text-sm text-white/60 uppercase text-shadow-lg',
                                                            GEIST_MONO.className
                                                        )}>
                                                            leximory.com
                                                        </p>
                                                        <div className='flex-1'></div>
                                                        <p className='text-center font-kaiti text-sm text-white/60 uppercase text-shadow-lg'>
                                                            语言学地学语言
                                                        </p>
                                                    </footer>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )
                                })}
                            </div>

                            <div className='absolute -bottom-15 left-1/2 -translate-x-1/2 w-full flex justify-evenly items-center gap-6'>
                                <button
                                    onClick={handleSaveImage}
                                    disabled={isSaving}
                                    className='text-foreground/50 hover:text-foreground text-medium shrink-0 font-mono tracking-wide uppercase transition-all disabled:opacity-50'
                                >
                                    [ {isSaving ? 'Saving ...' : 'Save Image'} ]
                                </button>
                                <button
                                    onClick={onClose}
                                    className='text-foreground/50 hover:text-foreground text-medium shrink-0 font-mono tracking-wide uppercase transition-all'
                                >
                                    [ Dismiss ]
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    )
}
