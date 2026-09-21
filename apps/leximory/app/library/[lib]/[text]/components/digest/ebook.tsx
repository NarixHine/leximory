'use client'

import { Button } from '@heroui/button'
import type { Contents, Rendition } from 'epubjs'
import {
    PiBookmark,
    PiFrameCorners,
    PiMagnifyingGlassMinus,
    PiMagnifyingGlassPlus,
} from 'react-icons/pi'
import EpubReader from '@repo/ui/epub-reader'
import { getBracketedSelection, getSelectionText } from '@repo/ui/define/utils'
import PdfReader from '@repo/ui/pdfium-reader'
import { getLanguageStrategy } from '@/lib/languages/strategies'
import { cn } from '@/lib/utils'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
    bookmarksAtom,
    ebookAtom,
    initialLocationAtom,
    isFullViewportAtom,
    locationAtom,
    textAtom,
    titleAtom,
} from '../../atoms'
import { langAtom } from '../../../atoms'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useFullScreenHandle, FullScreen } from 'react-full-screen'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { getChapterName } from '@/lib/epub'
import { findTextRange, highlightTextRange } from '@/lib/bookmarks'
import Define from '@/components/define'
import { saveBookmarkAction, saveLocationAction } from '@/service/bookmark'

function transformEbookUrl(url: string) {
    const match = url.match(/\/ebooks\/([^/]+)\.(epub|pdf)\?token=([^&]+)/)
    if (match) {
        const [, id, extension, token] = match
        return `/ebooks/${token}/${id}.${extension}`
    }
    return url
}

/**
 * Writes the reader's position to the server, debounced so page flips do not
 * spam requests. The atom still updates immediately for the reader's controlled
 * location. Server persistence replaces the old per-browser localStorage value
 * so every device resumes at the same place.
 */
function useLocationSync(text: string, setLocation: (location: string | number) => void) {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pending = useRef<string | null>(null)

    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current)
        },
        [],
    )

    return useCallback(
        (location: string | number) => {
            setLocation(location)
            pending.current = String(location)
            if (timer.current) clearTimeout(timer.current)
            timer.current = setTimeout(() => {
                const value = pending.current
                if (value !== null) void saveLocationAction({ textId: text, location: value })
            }, 1500)
        },
        [text, setLocation],
    )
}

const EBOOK_DARK_FG = '#CECDC3'
const EBOOK_DARK_BG = '#100F0F'
const EBOOK_LIGHT_FG = '#100F0F'
const EBOOK_LIGHT_BG = '#ffffff'

const PDF_WIDTHS = [704, 804, 904, 1004]

/** Injects a `<style>` with `!important` rules into an epub content frame to enforce reader styles over custom epub styles. */
function injectThemeCSS(contents: Contents, isDark: boolean, isJapanese: boolean) {
    const doc = contents.document
    if (!doc?.head) return
    let style = doc.getElementById('leximory-theme-override')
    if (!style) {
        style = doc.createElement('style')
        style.id = 'leximory-theme-override'
        doc.head.appendChild(style)
    }

    const colors = isDark
        ? `* { color: ${EBOOK_DARK_FG} !important; } body { background-color: ${EBOOK_DARK_BG} !important; }`
        : ''
    const japaneseWritingMode = isJapanese
        ? `html, body { direction: ltr !important; writing-mode: vertical-rl !important; -webkit-writing-mode: vertical-rl !important; text-orientation: mixed !important; }`
        : ''

    style.textContent = `${colors}${japaneseWritingMode}`
}

function updateTheme(rendition: Rendition, isDarkMode: boolean, isJapanese: boolean) {
    const themes = rendition.themes
    // In vertical Japanese, `vertical-rl` controls right-to-left column flow;
    // a right-to-left inline direction would make some runs flow bottom-to-top.
    themes.override('direction', 'ltr')
    if (isDarkMode) {
        themes.override('color', EBOOK_DARK_FG)
        themes.override('background', EBOOK_DARK_BG)
    } else {
        themes.override('color', EBOOK_LIGHT_FG)
        themes.override('background', EBOOK_LIGHT_BG)
    }
    ;(rendition.getContents() as unknown as Contents[]).forEach(c =>
        injectThemeCSS(c, isDarkMode, isJapanese),
    )
}

/** Widen control shown left of the PDF footer page counter. */
function WidthToggle({ onPress, shrinking }: { onPress: () => void; shrinking: boolean }) {
    const label = shrinking ? '缩小 PDF 宽度' : '放大 PDF 宽度'
    return (
        <button
            type='button'
            aria-label={label}
            title={label}
            onClick={onPress}
            className='inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-current transition-colors hover:bg-default-100 focus-visible:bg-default-100 active:bg-default-200'
        >
            {shrinking ? (
                <PiMagnifyingGlassMinus className='text-sm' />
            ) : (
                <PiMagnifyingGlassPlus className='text-sm' />
            )}
        </button>
    )
}

function PdfEbook() {
    const title = useAtomValue(titleAtom)
    const text = useAtomValue(textAtom)
    const lang = useAtomValue(langAtom)
    const src = useAtomValue(ebookAtom)
    const bookmarks = useAtomValue(bookmarksAtom)
    const setBookmarks = useSetAtom(bookmarksAtom)
    const [location, setLocation] = useAtom(locationAtom)
    const syncLocation = useLocationSync(text, setLocation)
    const [selection, setSelection] = useState<Selection | null>(null)
    const [selectedText, setSelectedText] = useState<string | null>(null)
    const [rect, setRect] = useState({
        left: null as number | null,
        width: null as number | null,
        top: null as number | null,
        bottom: null as number | null,
    })
    const [bookmark, setBookmark] = useState<{
        quote: string
        chapter: string | null
        location: string | null
    } | null>(null)
    const [savingBookmark, startSavingBookmark] = useTransition()
    const [isFullViewport, setIsFullViewport] = useAtom(isFullViewportAtom)
    const [isFullScreen, setIsFullScreen] = useState(false)
    const { resolvedTheme } = useTheme()
    const handleFullScreen = useFullScreenHandle()
    const containerRef = useRef<HTMLDivElement>(null!)
    const [portalContainer, setPortalContainer] = useState<Element | null>(null)
    const setContainer = useCallback((element: HTMLDivElement | null) => {
        containerRef.current = element!
        setPortalContainer(element)
    }, [])
    const highlights = useMemo(() => bookmarks.map(bookmark => bookmark.quote), [bookmarks])

    const reset = useCallback(() => {
        setSelection(null)
        setSelectedText(null)
        setRect({ left: null, width: null, top: null, bottom: null })
        setBookmark(null)
    }, [])

    const handlePdfSelection = useCallback(
        (
            nextText: string,
            page: number,
            selectionRect: { left: number; top: number; width: number; height: number },
            context?: string,
        ) => {
            setSelection(null)
            const annotationPrompt = context ?? `<must>${nextText}</must>`
            setSelectedText(annotationPrompt)
            setLocation(String(page))
            setRect({
                left: selectionRect.left,
                width: selectionRect.width,
                top: selectionRect.top,
                bottom: selectionRect.top + selectionRect.height,
            })
            const quote = nextText.replace(/\s+/g, ' ').trim()
            setBookmark({ quote, chapter: `Page ${page}`, location: String(page) })
        },
        [setLocation],
    )

    const [widthStep, setWidthStep] = useState(0)
    const [widthDirection, setWidthDirection] = useState(1)
    const widthRef = useRef<HTMLDivElement>(null)
    const [availableWidth, setAvailableWidth] = useState(0)

    useEffect(() => {
        const parent = widthRef.current?.parentElement
        if (!parent) return
        const update = () => setAvailableWidth(parent.clientWidth)
        update()
        const observer = new ResizeObserver(update)
        observer.observe(parent)
        return () => observer.disconnect()
    }, [])

    if (!src) return null

    const canWiden = widthStep > 0 || availableWidth > PDF_WIDTHS[0] + 1
    const shrinking = widthStep > 0 && widthDirection === -1

    const cycleWidth = () => {
        let direction = widthDirection
        let next = widthStep + direction
        if (next > PDF_WIDTHS.length - 1) {
            direction = -1
            next = widthStep - 1
        } else if (next < 0) {
            direction = 1
            next = widthStep + 1
        }
        setWidthDirection(direction)
        setWidthStep(next)
    }

    return (
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
                    ease: 'easeInOut',
                },
            }}
            layout='preserve-aspect'
        >
            <FullScreen
                handle={handleFullScreen}
                onChange={setIsFullScreen}
                className={cn(
                    'block relative dark:opacity-95',
                    isFullViewport ? 'h-full' : 'h-[80dvh]',
                )}
            >
                <div ref={setContainer} className='relative h-full bg-background'>
                    <Define
                        {...rect}
                        reset={reset}
                        container={containerRef.current}
                        selection={selectedText ? null : selection}
                        selectedText={selectedText ?? undefined}
                        actions={
                            <BookmarkButton
                                isDisabled={!bookmark}
                                isLoading={savingBookmark}
                                onPress={() => {
                                    if (!bookmark) return
                                    startSavingBookmark(async () => {
                                        try {
                                            const created = await saveBookmarkAction({
                                                textId: text,
                                                quote: bookmark.quote,
                                                chapter: bookmark.chapter,
                                                location: bookmark.location,
                                            })
                                            setBookmarks(prev => [...prev, created])
                                            reset()
                                            toast.success('文摘已保存')
                                        } catch {
                                            toast.error('文摘保存失败，请重试')
                                        }
                                    })
                                }}
                            />
                        }
                    />
                    <div
                        ref={widthRef}
                        className='mx-auto h-full w-full'
                        style={{ maxWidth: PDF_WIDTHS[widthStep] }}
                    >
                        <PdfReader
                            key={`${isFullViewport ? 'viewport' : 'window'}-${isFullScreen ? 'fullscreen' : 'normal'}`}
                            url={transformEbookUrl(src)}
                            title={title}
                            selectionContextRadius={getLanguageStrategy(lang).selectionContextRadius}
                            sentenceEndMarkers={getLanguageStrategy(lang).sentenceEndMarkers}
                            dark={resolvedTheme === 'dark'}
                            initialPage={Number(location) || 1}
                            highlights={highlights}
                            portalContainer={portalContainer ?? undefined}
                            onLocationChange={page => syncLocation(Number(page))}
                            onSelection={handlePdfSelection}
                            onSelectionClear={reset}
                            footerLeading={
                                canWiden ? (
                                    <WidthToggle onPress={cycleWidth} shrinking={shrinking} />
                                ) : null
                            }
                            actions={
                                <>
                                    <Button
                                        isIconOnly
                                        startContent={<PiFrameCorners className='text-xl' />}
                                        className='z-10'
                                        color='primary'
                                        variant='light'
                                        size='lg'
                                        radius='full'
                                        onPress={async () => {
                                            try {
                                                if (isFullScreen) await handleFullScreen.exit()
                                                else await handleFullScreen.enter()
                                            } catch {
                                                setIsFullViewport(value => !value)
                                            }
                                        }}
                                    />
                                </>
                            }
                        />
                    </div>
                </div>
            </FullScreen>
        </motion.div>
    )
}

/** Icon-only bookmark action rendered beside the Define trigger. */
function BookmarkButton({
    isDisabled,
    isLoading,
    onPress,
}: {
    isDisabled: boolean
    isLoading: boolean
    onPress: () => void
}) {
    return (
        <Button
            isIconOnly
            isLoading={isLoading}
            isDisabled={isDisabled}
            startContent={!isLoading && <PiBookmark className='text-xl' />}
            color='default'
            variant='flat'
            size='md'
            radius='full'
            className='h-10 w-10 min-w-10 bg-default-200 text-foreground hover:bg-default-300'
            onPress={onPress}
        />
    )
}

function EpubEbook() {
    const title = useAtomValue(titleAtom)
    const text = useAtomValue(textAtom)
    const lang = useAtomValue(langAtom)
    const src = useAtomValue(ebookAtom)
    const bookmarks = useAtomValue(bookmarksAtom)
    const setBookmarks = useSetAtom(bookmarksAtom)
    const [location, setLocation] = useAtom(locationAtom)
    const syncLocation = useLocationSync(text, setLocation)
    const strategy = useMemo(() => getLanguageStrategy(lang), [lang])
    const isJapanese = strategy.type === 'ja'

    const [selection, setSelection] = useState<Selection | null>(null)
    const [selectedText, setSelectedText] = useState<string | null>(null)
    const [rect, setRect] = useState<{
        left: number | null
        width: number | null
        top: number | null
        bottom: number | null
    }>({
        left: null,
        width: null,
        top: null,
        bottom: null,
    })
    const reset = () => {
        setRect({
            left: null,
            width: null,
            top: null,
            bottom: null,
        })
        setSelection(null)
        setSelectedText(null)
    }
    const [bookmark, setBookmark] = useState<{
        quote: string
        chapter: string | null
        location: string | null
    } | null>(null)
    const [savingBookmark, startSavingBookmark] = useTransition()
    const themeRendition = useRef<Rendition | null>(null)

    const { resolvedTheme } = useTheme()
    const isDarkMode = resolvedTheme === 'dark'
    const isDarkModeRef = useRef(isDarkMode)
    isDarkModeRef.current = isDarkMode
    useEffect(() => {
        if (themeRendition.current) {
            updateTheme(themeRendition.current, isDarkMode, isJapanese)
        }
    }, [isDarkMode, isJapanese, lang])

    // Bookmark highlighting is applied to the text DOM inside each EPUB iframe.
    // This avoids epub.js SVG overlays being detached during resize/fullscreen.
    const bookmarksRef = useRef(bookmarks)
    bookmarksRef.current = bookmarks

    /** Highlights the current user's bookmark selections in the rendered EPUB sections. */
    const highlightBookmarks = useCallback((rendition: Rendition) => {
        const quotes = bookmarksRef.current.map(bookmark => bookmark.quote)
        if (quotes.length === 0) return

        const contentsList = rendition.getContents() as unknown as Contents[]
        for (const contents of contentsList) {
            for (const quote of quotes) {
                const range = findTextRange(contents.document.body, quote)
                if (!range) continue

                try {
                    highlightTextRange(range, isDarkModeRef.current)
                } catch {
                    continue
                }
            }
        }
    }, [])

    const retryHighlights = useCallback((rendition: Rendition) => {
        highlightBookmarks(rendition)
        requestAnimationFrame(() => highlightBookmarks(rendition))
        window.setTimeout(() => highlightBookmarks(rendition), 100)
        window.setTimeout(() => highlightBookmarks(rendition), 500)
    }, [highlightBookmarks])

    // Re-apply whenever the user's bookmarks change so newly saved ones get
    // highlighted; the DOM guard keeps existing highlights from being re-added.
    useEffect(() => {
        const rendition = themeRendition.current
        if (!rendition) return
        highlightBookmarks(rendition)
    }, [bookmarks, highlightBookmarks])

    const handleFullScreen = useFullScreenHandle()
    const [isFullViewport, setIsFullViewport] = useAtom(isFullViewportAtom)
    const [isFullScreen, setIsFullScreen] = useState(false)
    const hasZoomed = isFullViewport || isFullScreen
    const containerRef = useRef<HTMLDivElement>(null!)

    return (
        src && (
            <motion.div
                className='bg-background pt-5'
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
                        ease: 'easeInOut',
                    },
                }}
                layout='preserve-aspect'
            >
                <FullScreen
                    handle={handleFullScreen}
                    onChange={isFullScreen => setIsFullScreen(isFullScreen)}
                    className={cn(
                        'block relative dark:opacity-95',
                        isFullViewport ? 'h-full' : 'h-[80dvh]',
                    )}
                >
                    <div
                        ref={containerRef}
                        className='relative bg-background h-full'
                        style={{ transform: 'translateZ(0)' }}
                    >
                        {hasZoomed && (
                            <Define
                                {...rect}
                                reset={reset}
                                container={containerRef.current}
                                selection={selection}
                                selectedText={selectedText ?? undefined}
                                actions={
                                    <BookmarkButton
                                        isDisabled={!bookmark}
                                        isLoading={savingBookmark}
                                        onPress={() => {
                                            if (!bookmark) return
                                            startSavingBookmark(async () => {
                                                try {
                                                    const created = await saveBookmarkAction({
                                                        textId: text,
                                                        quote: bookmark.quote,
                                                        chapter: bookmark.chapter,
                                                        location: bookmark.location,
                                                    })
                                                    setBookmarks(prev => [...prev, created])
                                                    reset()
                                                    toast.success('文摘已保存')
                                                } catch {
                                                    toast.error('文摘保存失败，请重试')
                                                }
                                            })
                                        }}
                                    />
                                }
                            />
                        )}
                        <EpubReader
                            key={`${isFullViewport ? 'viewport' : 'window'}-${isFullScreen ? 'fullscreen' : 'normal'}`}
                            title={title}
                            isRTL={strategy.isRTL}
                            writingMode={isJapanese ? 'vertical-rl' : undefined}
                            location={location}
                            onLocationChange={epubcifi => {
                                syncLocation(epubcifi)
                            }}
                            getRendition={rendition => {
                                updateTheme(rendition, isDarkMode, isJapanese)
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
                                        'font-family':
                                            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace !important',
                                        'font-size': '1rem !important',
                                        'line-height': '1.5 !important',
                                    },
                                    code: {
                                        'font-family':
                                            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace !important',
                                        'font-size': '0.9em !important',
                                    },
                                    pre: {
                                        'font-family':
                                            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace !important',
                                        'font-size': '0.9em !important',
                                        'overflow-x': 'auto !important',
                                        'line-height': '1.5 !important',
                                    },
                                })
                                themeRendition.current = rendition
                                rendition.on('selected', (_: Rendition, contents: Contents) => {
                                    const selection = contents.window.getSelection()
                                    if (!selection || selection.rangeCount === 0) {
                                        setBookmark(null)
                                        return
                                    }
                                    const quote = getSelectionText(selection)
                                    if (!quote) {
                                        reset()
                                        setBookmark(null)
                                        return
                                    }
                                    const prompt =
                                        getBracketedSelection(
                                            selection,
                                            strategy.selectionContextRadius,
                                        ) || `<must>${quote}</must>`
                                    setSelection(selection)
                                    setSelectedText(prompt)

                                    const range = selection.getRangeAt(0)
                                    const bounds = range.getBoundingClientRect()
                                    const frameElement = contents.window.frameElement
                                    const epubBounds = frameElement?.getBoundingClientRect() ?? {
                                        left: 0,
                                        top: 0,
                                    }
                                    setRect({
                                        left: bounds.left + epubBounds.left,
                                        width: bounds.width,
                                        top: bounds.top + epubBounds.top,
                                        bottom: bounds.bottom + epubBounds.top,
                                    })

                                    const chapter = getChapterName(
                                        rendition.book,
                                        rendition.location,
                                    )
                                    let cfi: string | null = null
                                    try {
                                        cfi = contents.cfiFromRange(range)
                                    } catch {
                                        cfi = null
                                    }
                                    setBookmark({
                                        quote,
                                        chapter: chapter ?? null,
                                        location: cfi,
                                    })
                                })
                                rendition.on(
                                    'rendered',
                                    (_section: unknown, view: { contents?: Contents }) => {
                                        const contents = view.contents
                                        if (!contents) return
                                        injectThemeCSS(contents, isDarkModeRef.current, isJapanese)
                                        contents.document.addEventListener('selectionchange', () => {
                                            const currentSelection = contents.window.getSelection()
                                            if (currentSelection?.toString()) return
                                            reset()
                                        })
                                        retryHighlights(rendition)
                                    },
                                )
                                rendition.on('displayed', () => retryHighlights(rendition))
                                rendition.on('relocated', () => retryHighlights(rendition))
                            }}
                            url={transformEbookUrl(src)}
                            portalContainer={hasZoomed ? containerRef.current : undefined}
                            actions={
                                <>
                                    <Button
                                        isIconOnly
                                        startContent={<PiFrameCorners className='text-xl' />}
                                        className='z-10'
                                        color='primary'
                                        variant='light'
                                        size='lg'
                                        radius='full'
                                        onPress={async () => {
                                            try {
                                                if (isFullScreen) {
                                                    await handleFullScreen.exit()
                                                } else {
                                                    await handleFullScreen.enter()
                                                }
                                            } catch {
                                                setIsFullViewport(!isFullViewport)
                                            }
                                        }}
                                    />
                                </>
                            }
                        />
                    </div>
                </FullScreen>
            </motion.div>
        )
    )
}

export default function Ebook() {
    const src = useAtomValue(ebookAtom)
    const text = useAtomValue(textAtom)
    const initialLocation = useAtomValue(initialLocationAtom)
    const setLocation = useSetAtom(locationAtom)
    const seededText = useRef<string | null>(null)

    // Seed the reader from the server-persisted position exactly once per text.
    // The live location atom must not follow later server renders: a debounced
    // location save re-renders the route, and re-hydrating the atom would pull
    // the reader back to the last saved page.
    useEffect(() => {
        if (seededText.current === text) return
        seededText.current = text
        if (initialLocation !== null && initialLocation !== 0) setLocation(initialLocation)
    }, [text, initialLocation, setLocation])

    if (src?.match(/\.pdf(?:\?|$)/i)) return <PdfEbook />
    return <EpubEbook />
}
