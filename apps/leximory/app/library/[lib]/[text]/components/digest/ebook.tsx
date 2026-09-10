'use client'

import { Button } from '@heroui/button'
import type { Contents, Rendition } from 'epubjs'
import { PiBookmark, PiFrameCorners } from 'react-icons/pi'
import EpubReader from '@repo/ui/epub-reader'
import { getLanguageStrategy } from '@/lib/languages/strategies'
import { cn } from '@/lib/utils'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { contentAtom, ebookAtom, isFullViewportAtom, textAtom, titleAtom } from '../../atoms'
import { isReadOnlyAtom, langAtom } from '../../../atoms'
import { useAtom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useFullScreenHandle, FullScreen } from 'react-full-screen'
import { atomFamily } from 'jotai/utils'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { getChapterName } from '@/lib/epub'
import { findTextRange, parseBookmarks } from '@/lib/bookmarks'
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
    atomWithStorage<string | number>(`persist-location-${text}`, 0),
)

const EBOOK_DARK_FG = '#CECDC3'
const EBOOK_DARK_BG = '#100F0F'
const EBOOK_LIGHT_FG = '#100F0F'
const EBOOK_LIGHT_BG = '#ffffff'

/** Class applied to the SVG overlays epub.js renders for bookmarked ranges. */
const BOOKMARK_HIGHLIGHT_CLASS = 'leximory-bookmark'

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

export default function Ebook() {
    const title = useAtomValue(titleAtom)
    const text = useAtomValue(textAtom)
    const [content, setContent] = useAtom(contentAtom)
    const lang = useAtomValue(langAtom)
    const src = useAtomValue(ebookAtom)
    const isReadOnly = useAtomValue(isReadOnlyAtom)
    const [location, setLocation] = useAtom(locationAtomFamily(text))
    const strategy = useMemo(() => getLanguageStrategy(lang), [lang])
    const isJapanese = strategy.type === 'ja'

    const [selection, setSelection] = useState<Selection | null>(null)
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
    }
    const [bookmark, setBookmark] = useState<string | null>(null)
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

    // Bookmark highlighting: remember which ranges were already annotated so
    // pagination/re-renders do not stack duplicate SVG overlays, and which
    // sections have been scanned so we only search each one once.
    const contentRef = useRef(content)
    contentRef.current = content
    const highlightedCfisRef = useRef<Set<string>>(new Set())
    const scannedSectionsRef = useRef<Set<number>>(new Set())

    /** Highlights bookmark selections in the currently rendered EPUB sections. */
    const highlightBookmarks = useCallback((rendition: Rendition) => {
        const selections = parseBookmarks(contentRef.current).map(bookmark => bookmark.text)
        if (selections.length === 0) return

        const contentsList = rendition.getContents() as unknown as Contents[]
        for (const contents of contentsList) {
            if (scannedSectionsRef.current.has(contents.sectionIndex)) continue

            for (const text of selections) {
                const range = findTextRange(contents.document.body, text)
                if (!range) continue

                let cfi: string
                try {
                    cfi = contents.cfiFromRange(range)
                } catch {
                    continue
                }
                if (!cfi || highlightedCfisRef.current.has(cfi)) continue

                highlightedCfisRef.current.add(cfi)
                try {
                    rendition.annotations.highlight(
                        cfi,
                        {},
                        undefined,
                        BOOKMARK_HIGHLIGHT_CLASS,
                    )
                } catch {
                    highlightedCfisRef.current.delete(cfi)
                }
            }

            scannedSectionsRef.current.add(contents.sectionIndex)
        }
    }, [])

    // Re-scan rendered sections whenever the digest content changes so newly
    // saved bookmarks (or updates synced from elsewhere) get highlighted. The
    // CFI guard keeps existing highlights from being re-added.
    useEffect(() => {
        const rendition = themeRendition.current
        if (!rendition) return
        scannedSectionsRef.current = new Set()
        highlightBookmarks(rendition)
    }, [content, highlightBookmarks])

    const handleFullScreen = useFullScreenHandle()
    const [isFullViewport, setIsFullViewport] = useAtom(isFullViewportAtom)
    const [isFullScreen, setIsFullScreen] = useState(false)
    const hasZoomed = isFullViewport || isFullScreen
    const containerRef = useRef<HTMLDivElement>(null!)

    const router = useRouter()

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
                            />
                        )}
                        <EpubReader
                            key={isFullViewport ? 'full' : 'normal'}
                            title={title}
                            isRTL={strategy.isRTL}
                            writingMode={isJapanese ? 'vertical-rl' : undefined}
                            location={location}
                            onLocationChange={epubcifi => {
                                setLocation(epubcifi)
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
                                highlightedCfisRef.current = new Set()
                                scannedSectionsRef.current = new Set()
                                rendition.on('selected', (_: Rendition, contents: Contents) => {
                                    const selection = contents.window.getSelection()!
                                    setSelection(selection)

                                    const rect = selection.getRangeAt(0).getBoundingClientRect()
                                    const frameElement = contents.window.frameElement
                                    const epubBounds = frameElement?.getBoundingClientRect() ?? {
                                        left: 0,
                                        top: 0,
                                    }
                                    setRect({
                                        left: rect.left + epubBounds.left,
                                        width: rect.width,
                                        top: rect.top + epubBounds.top,
                                        bottom: rect.bottom + epubBounds.top,
                                    })

                                    const chapter = getChapterName(
                                        rendition.book,
                                        rendition.location,
                                    )
                                    setBookmark(
                                        selection
                                            ? `\n\n> ${selection
                                                  .toString()
                                                  .concat(chapter ? `\n— *${chapter}*` : '')
                                                  .replaceAll('\n', '\n>\n> ')}`
                                            : null,
                                    )
                                })
                                rendition.on('rendered', (_: Rendition, contents: Contents) => {
                                    injectThemeCSS(contents, isDarkModeRef.current, isJapanese)
                                    contents.document.addEventListener('selectionchange', () => {
                                        const currentSelection = contents.window.getSelection()
                                        if (currentSelection?.toString()) return
                                        reset()
                                    })
                                    highlightBookmarks(rendition)
                                })
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
                                    {hasZoomed && (
                                        <>
                                            <Button
                                                startContent={
                                                    !savingBookmark && (
                                                        <PiBookmark className='text-xl' />
                                                    )
                                                }
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
                                                                const newContent =
                                                                    content.concat(bookmark)
                                                                await saveText({
                                                                    id: text,
                                                                    content: newContent,
                                                                })
                                                                router.refresh()
                                                                setContent(newContent)
                                                                // The content effect re-scans and
                                                                // highlights the new bookmark.
                                                                toast.success('文摘已保存')
                                                            } catch {
                                                                toast.error('文摘保存失败，请重试')
                                                            }
                                                        })
                                                    }
                                                }}
                                            ></Button>
                                        </>
                                    )}
                                </>
                            }
                        />
                    </div>
                </FullScreen>
            </motion.div>
        )
    )
}
