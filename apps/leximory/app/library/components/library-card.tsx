'use client'

import { useState, useRef, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { Lang } from '@repo/schema/library'
import { prefixUrl } from '@repo/env/config'
import { domToPng } from 'modern-screenshot'
import { useIsClient, useEventListener } from 'usehooks-ts'
import { cn } from '@/lib/utils'
import { EMOJI, GEIST_MONO } from '@/lib/fonts'
import { getLanguageStrategy } from '@/lib/languages'
import { toast } from 'sonner'
import { StackedCards, CardModal, BgTheme, themeImages, themeOverlayClasses } from './stacked-cards'

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
    const cardRef = useRef<HTMLDivElement>(null)
    const isClient = useIsClient()
    const strategy = getLanguageStrategy(lang)
    const learningWith = strategy.libraryCardLabels.learningWith
    const articleTitleFont = strategy.articleTitleFont

    const themes: BgTheme[] = ['forest', 'idyll', 'lake', 'night']

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

    const renderCardContent = () => (
        <>
            <div>
                <h2 className={cn('font-fancy text-6xl tracking-tight text-white leading-tight -mb-2')}>
                    {creatorName}
                </h2>
                <p className='text-2xl text-balance font-sans tracking-tight font-semibold leading-tight text-shadow-lg mt-1'>
                    {learningWith}
                </p>
            </div>

            <div className='bg-white/60 h-1 rounded-lg w-1/3 mt-4 mb-3'></div>

            <div className='flex-1 flex flex-col justify-center space-y-1'>
                {texts?.slice(0, 5).map((text) => (
                    <div key={text.id} className='flex items-center gap-3'>
                        <div className={cn(
                            'shrink-0 w-12 h-12 text-white rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-2xl shadow-lg',
                            EMOJI.className
                        )}>
                            {text.emoji || '📄'}
                        </div>
                        <div className='flex-1 min-w-0'>
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
                    'text-center text-sm text-white/75 uppercase text-shadow-lg',
                    GEIST_MONO.className
                )}>
                    leximory.com
                </p>
                <div className='flex-1'></div>
                <p className='text-center font-kaiti text-sm text-white/75 uppercase text-shadow-lg'>
                    语言学地学语言
                </p>
            </footer>
        </>
    )

    return (
        <AnimatePresence>
            {isOpen && (
                <CardModal isOpen={isOpen} onClose={onClose}>
                    <StackedCards
                        themes={themes}
                        defaultTheme={bgTheme}
                        themeImages={themeImages}
                        themeOverlayClasses={themeOverlayClasses}
                        selectedRef={cardRef}
                    >
                        {renderCardContent}
                    </StackedCards>

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
                </CardModal>
            )}
        </AnimatePresence>
    )
}
