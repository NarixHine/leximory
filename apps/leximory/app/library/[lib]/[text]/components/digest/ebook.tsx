'use client'

import { Button } from '@heroui/button'
import type { Contents, Rendition } from 'epubjs'
import { PiBookmark, PiFrameCorners } from 'react-icons/pi'
import EpubReader from '@repo/ui/epub-reader'
import { getLanguageStrategy } from '@/lib/languages/strategies'
import { cn } from '@/lib/utils'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { contentAtom, ebookAtom, isFullViewportAtom, textAtom, titleAtom } from '../../atoms'
import { isReadOnlyAtom, langAtom } from '../../../atoms'
import { useAtom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useFullScreenHandle, FullScreen } from 'react-full-screen'
import { atomFamily } from 'jotai/utils'
import { motion } from 'framer-motion'
import { useDarkMode, useScrollLock } from 'usehooks-ts'
import { toast } from 'sonner'
import { getChapterName } from '@/lib/epub'
import Define from '@/components/define'
import { useRouter } from 'next/navigation'
import { saveText } from '@/service/text'

function transformEbookUrl(url: string) {
    const match = url.match(/\/ebooks\/([^/]+)\.epub\?token=([^&]+)/)
    if (match) {
        const [, id, token] = match
        return `/ebooks/${token}/${id}.epub`
    }
    return url
}

const locationAtomFamily = atomFamily((text: string) =>
    atomWithStorage<string | number>(`persist-location-${text}`, 0)
)

const EBOOK_DARK_FG = '#CECDC3'
const EBOOK_DARK_BG = '#100F0F'
const EBOOK_LIGHT_FG = '#100F0F'
const EBOOK_LIGHT_BG = '#ffffff'

/** Injects a `<style>` with `!important` rules into an epub content frame to enforce theme colors over custom epub styles. */
function injectThemeCSS(contents: Contents, isDark: boolean) {
    const doc = contents.document
    if (!doc?.head) return
    let style = doc.getElementById('leximory-theme-override')
    if (!style) {
        style = doc.createElement('style')
        style.id = 'leximory-theme-override'
        doc.head.appendChild(style)
    }
    style.textContent = isDark
        ? `* { color: ${EBOOK_DARK_FG} !important; } body { background-color: ${EBOOK_DARK_BG} !important; }`
        : ``
}

function updateTheme(rendition: Rendition, isDarkMode: boolean) {
    const themes = rendition.themes
    themes.override('direction', 'ltr')
    if (isDarkMode) {
        themes.override('color', EBOOK_DARK_FG)
        themes.override('background', EBOOK_DARK_BG)
    } else {
        themes.override('color', EBOOK_LIGHT_FG)
        themes.override('background', EBOOK_LIGHT_BG)
    }
    ; (rendition.getContents() as unknown as Contents[]).forEach((c) => injectThemeCSS(c, isDarkMode))
}

export default function Ebook() {
    const title = useAtomValue(titleAtom)
    const text = useAtomValue(textAtom)
    const [content, setContent] = useAtom(contentAtom)
    const lang = useAtomValue(langAtom)
    const src = useAtomValue(ebookAtom)
    const isReadOnly = useAtomValue(isReadOnlyAtom)
    const [location, setLocation] = useAtom(locationAtomFamily(text))
    const strategy = useMemo(() => getLanguageStrategy(lang), [lang])

    const [selection, setSelection] = useState<Selection | null>(null)
    const [rect, setRect] = useState<{ left: number | null, width: number | null, bottom: number | null }>({
        left: null,
        width: null,
        bottom: null
    })
    const reset = () => {
        setRect({
            left: null,
            width: null,
            bottom: null
        })
        setSelection(null)
    }
    const [bookmark, setBookmark] = useState<string | null>(null)
    const [savingBookmark, startSavingBookmark] = useTransition()
    const themeRendition = useRef<Rendition | null>(null)

    const { isDarkMode } = useDarkMode()
    const isDarkModeRef = useRef(isDarkMode)
    isDarkModeRef.current = isDarkMode
    useEffect(() => {
        if (themeRendition.current) {
            updateTheme(themeRendition.current, isDarkMode)
        }
    }, [lang, isDarkMode])

    const handleFullScreen = useFullScreenHandle()
    const [isFullViewport, setIsFullViewport] = useAtom(isFullViewportAtom)
    const [isFullScreen, setIsFullScreen] = useState(true) // flips to false on load
    const hasZoomed = isFullViewport || isFullScreen
    const containerRef = useRef<HTMLDivElement>(null!)

    const { lock, unlock } = useScrollLock({ autoLock: false })
    useEffect(() => {
        if (hasZoomed) {
            lock()
        } else {
            unlock()
        }
        return unlock
    }, [hasZoomed, lock, unlock])

    const router = useRouter()

    return src && (
        <motion.div
            className='bg-background'
            style={{
                position: isFullViewport ? 'fixed' : 'relative',
                width: isFullViewport ? '100dvw' : 'auto',
                height: isFullViewport ? '100dvh' : 'auto',
                zIndex: isFullViewport ? 999 : 0,
                left: isFullViewport ? 0 : 'auto',
                top: isFullViewport ? 0 : 'auto',
                right: isFullViewport ? 0 : 'auto',
            }}
            transition={{
                layout: {
                    duration: 0.5,
                    ease: 'easeInOut'
                }
            }}
            layout='preserve-aspect'
        >
            <FullScreen handle={handleFullScreen} onChange={() => setIsFullScreen(!isFullScreen)} className={cn('block relative dark:opacity-95', isFullViewport ? 'h-dvh' : 'h-[80dvh]')}>
                <div ref={containerRef} className='relative bg-background h-full' style={{ transform: 'translateZ(0)' }}>
                    {hasZoomed && <Define
                        {...rect}
                        reset={reset}
                        container={containerRef.current}
                        selection={selection}
                    />}
                    <EpubReader
                        key={isFullViewport ? 'full' : 'normal'}
                        title={title}
                        isRTL={strategy.isRTL}
                        location={location}
                        onLocationChange={epubcifi => {
                            setLocation(epubcifi)
                        }}
                        getRendition={rendition => {
                            updateTheme(rendition, isDarkMode)
                            rendition.themes.default({
                                p: {
                                    'margin-top': '0.6em',
                                    'margin-bottom': '0.6em',
                                    'font-size': '24px !important',
                                    'font-family': '"Athelas", Georgia, serif !important',
                                    'line-height': strategy.lineHeight,
                                    'text-rendering': 'optimizeLegibility',
                                },
                                div: {
                                    'font-size': '24px !important',
                                    'font-family': '"Athelas", Georgia, serif !important',
                                    'line-height': strategy.lineHeight,
                                    'text-rendering': 'optimizeLegibility',
                                },
                                h1: {
                                    'font-family': '"Baskerville", Georgia, serif !important',
                                },
                                h2: {
                                    'font-family': '"Baskerville", Georgia, serif !important',
                                },
                                h3: {
                                    'font-family': '"Baskerville", Georgia, serif !important',
                                },
                                '.codeline': {
                                    'font-family': 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace !important',
                                    'font-size': '1rem !important',
                                    'line-height': '1.5 !important',
                                },
                                'code': {
                                    'font-family': 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace !important',
                                    'font-size': '0.9em !important',
                                },
                                'pre': {
                                    'font-family': 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace !important',
                                    'font-size': '0.9em !important',
                                    'overflow-x': 'auto !important',
                                    'line-height': '1.5 !important',
                                },
                            })
                            themeRendition.current = rendition
                            rendition.on('selected', (_: Rendition, contents: Contents) => {
                                const selection = contents.window.getSelection()!
                                setSelection(selection)

                                const rect = selection.getRangeAt(0).getBoundingClientRect()
                                const epubView = document.getElementsByClassName('epub-view')[0]
                                const offset = epubView ? epubView.getBoundingClientRect() : { left: 0, top: 0 }

                                setRect({
                                    left: rect.left + offset.left - (isFullViewport ? 16 : 0),
                                    width: rect.width,
                                    bottom: rect.bottom + offset.top
                                })

                                const chapter = getChapterName(rendition.book, rendition.location)
                                setBookmark(selection ? `\n\n> ${selection.toString().concat(chapter ? `\n— *${chapter}*` : '').replaceAll('\n', '\n>\n> ')}` : null)
                            })
                            rendition.on('rendered', (_: Rendition, contents: Contents) => {
                                injectThemeCSS(contents, isDarkModeRef.current)
                                contents.document.addEventListener('selectionchange', () => {
                                    if (selection && selection.toString()) {
                                        return
                                    }
                                    reset()
                                })
                            })
                        }}
                        url={transformEbookUrl(src)}
                        portalContainer={hasZoomed ? containerRef.current : undefined}
                        actions={
                            <>
                                <Button
                                    isIconOnly
                                    startContent={<PiFrameCorners className='text-lg' />}
                                    className='z-10'
                                    color='primary'
                                    variant='light'
                                    size='lg'
                                    radius='full'
                                    onPress={async () => {
                                        try {
                                            if (isFullScreen)
                                                await handleFullScreen.exit()
                                            else
                                                await handleFullScreen.enter()
                                        } catch {
                                            setIsFullViewport(!isFullViewport)
                                        }
                                    }}
                                />
                                {hasZoomed && <>
                                    <Button
                                        startContent={!savingBookmark && <PiBookmark className='text-lg' />}
                                        isLoading={savingBookmark}
                                        isDisabled={!bookmark || isReadOnly}
                                        className='z-10'
                                        color='primary'
                                        variant='light'
                                        size='lg'
                                        radius='full'
                                        isIconOnly
                                        onPress={() => {
                                            if (bookmark) {
                                                startSavingBookmark(async () => {
                                                    try {
                                                        const newContent = content.concat(bookmark)
                                                        await saveText({ id: text, content: newContent })
                                                        router.refresh()
                                                        setContent(newContent)
                                                        toast.success('文摘已保存')
                                                    } catch {
                                                        toast.error('文摘保存失败，请重试')
                                                    }
                                                })
                                            }
                                        }}>
                                    </Button>
                                </>}
                            </>
                        }
                    />
                </div>
            </FullScreen>
        </motion.div>
    )
}
