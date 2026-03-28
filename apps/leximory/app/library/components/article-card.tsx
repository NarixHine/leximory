'use client'

import { useState, useRef, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { prefixUrl } from '@repo/env/config'
import { domToPng } from 'modern-screenshot'
import { useIsClient, useEventListener } from 'usehooks-ts'
import { cn } from '@/lib/utils'
import { EMOJI } from '@/lib/fonts'
import { getLanguageStrategy } from '@/lib/languages'
import { toast } from 'sonner'
import { StackedCards, CardModal, BgTheme, themeImages, themeOverlayClasses } from './stacked-cards'
import { commentSyntaxRegex } from '@repo/utils/comment'
import { removeRubyFurigana } from '@/lib/comment'
import Markdown from '@/components/markdown'

interface ArticleCardProps {
    isOpen: boolean
    onClose: () => void
    title: string
    libName: string
    libId: string
    textId: string
    content: string
    emoji?: string | null
    lang: string
    bgTheme?: BgTheme
}

export function ArticleCard({
    isOpen,
    onClose,
    title,
    libName,
    libId,
    textId,
    content,
    emoji,
    lang,
    bgTheme = 'forest',
}: ArticleCardProps) {
    const [isSaving, setIsSaving] = useState(false)
    const cardRef = useRef<HTMLDivElement>(null)
    const isClient = useIsClient()
    const strategy = getLanguageStrategy(lang as any)
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
            link.download = `leximory-${title.replace(/\s+/g, '-').toLowerCase()}.png`
            link.href = dataUrl
            link.click()
        } catch {
            toast.error('保存失败')
        } finally {
            setIsSaving(false)
        }
    }, [title])

    if (!isClient) return null

    const articleUrl = prefixUrl(`/read/${textId}`)
    const contentWithoutComments = content.replace(commentSyntaxRegex, (_, p1) => p1 || '')
    const contentWithoutRuby = removeRubyFurigana(contentWithoutComments)
    // get first sentence or first 100 characters as excerpt
    const excerpt = contentWithoutRuby.split(strategy.periodMark)[0].slice(0, 200) + (contentWithoutRuby.length > 200 ? '...' : '')

    const renderCardContent = () => (
        <>
            <div>
                <div className='grid grid-cols-[0fr_1fr] gap-3 mb-2 mt-2'>
                    <div className={cn(
                        'shrink-0 aspect-square h-full text-white rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-2xl shadow-lg',
                        EMOJI.className
                    )}>
                        {emoji || '📄'}
                    </div>
                    <h2 className={cn(
                        'font-fancy text-2xl py-2 pl-1 tracking-tight shrink line-clamp-2 text-white leading-tighter'
                    )}>
                        {title}
                    </h2>
                </div>
                <div className='font-sans text-lg text-white/75 tracking-tight mt-3'>
                    <div><span className='text-white/95 font-sans'>Leximory </span>上的<span className='text-white/95'>{strategy.name}</span>文本</div>
                    {strategy.FormattedReadingTime ? <div className={'truncate line-clamp-1'}>{strategy.FormattedReadingTime(content)}</div> : null}
                </div>
            </div>

            <div className='bg-white/60 h-px rounded-lg w-1/3 mt-4 mb-3'></div>

            <div className=''>
                <div className={cn(
                    'text-medium text-balance text-white/90 leading-relaxed text-shadow-lg',
                    articleTitleFont
                )}>
                    <Markdown md={excerpt} className='text-white/85 not-dropcap' />
                </div>
            </div>

            <div className='bg-white/60 h-px rounded-lg w-1/3 mt-3 mb-4'></div>

            <div className='flex-1' />

            <div className='grid grid-cols-[0.3fr_1fr] gap-4 items-center w-full'>
                <div className='h-full aspect-square flex items-center justify-start'>
                    <QRCodeSVG
                        value={articleUrl}
                        style={{ width: '100%', height: '100%' }}
                        bgColor='transparent'
                        fgColor='#FFFFFF'
                        level='L'
                    />
                </div>
                <div className='flex justify-end w-full'>
                    <h1 className='font-fancy leading-9 tracking-tight text-balance text-right text-3xl text-white'>
                        {libName}
                    </h1>
                </div>
            </div>

            <footer className='flex mt-3'>
                <p className={cn(
                    'text-center text-sm font-mono text-neutral-300/70 uppercase text-shadow-lg',
                )}>
                    leximory.com
                </p>
                <div className='flex-1'></div>
                <p className='text-center font-kaiti text-sm text-neutral-300/70 uppercase text-shadow-lg'>
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
