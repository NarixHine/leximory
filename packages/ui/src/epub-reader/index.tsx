'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { Contents, Rendition } from 'epubjs'
import ePub from 'epubjs'
import { CircularProgress, useDisclosure } from '@heroui/react'
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { sanitizeHTML } from '../utils/parse'
import {
    TocDrawer,
    TocTrigger,
    findTocLabel,
    hrefBase,
    subtreeContains,
    type TocItem,
} from '../toc'

export type { Book, Rendition, NavItem, Contents, Location } from 'epubjs'

export interface EpubReaderProps {
    url: string
    location: string | number
    onLocationChange: (epubcifi: string) => void
    getRendition?: (rendition: Rendition) => void
    isRTL?: boolean
    /** Sets the writing mode before epub.js calculates pagination. */
    writingMode?: 'horizontal-tb' | 'vertical-rl' | 'vertical-lr'
    title?: string
    tocTitle?: string
    actions?: ReactNode
    portalContainer?: Element
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function EpubReader({
    url,
    location,
    onLocationChange,
    getRendition: onRendition,
    isRTL = false,
    writingMode,
    title = '',
    tocTitle = '目录',
    actions,
    portalContainer,
}: EpubReaderProps) {
    const viewerRef = useRef<HTMLDivElement>(null)
    const renditionRef = useRef<Rendition | null>(null)
    const [isLoaded, setIsLoaded] = useState(false)
    const [toc, setToc] = useState<TocItem[]>([])
    const [currentHref, setCurrentHref] = useState('')
    const [currentPage, setCurrentPage] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const { isOpen, onOpen, onOpenChange } = useDisclosure()
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

    const onLocationChangeRef = useRef(onLocationChange)
    onLocationChangeRef.current = onLocationChange
    const onRenditionRef = useRef(onRendition)
    onRenditionRef.current = onRendition
    // A relocated event updates the controlled location prop. Do not display
    // that same location again: epub.js may re-resolve a split-page CFI to the
    // adjacent page when display() is called during an active pagination move.
    const lastReportedLocationRef = useRef<string | null>(null)

    useEffect(() => {
        if (!viewerRef.current) return

        const book = ePub(url)
        const rendition = book.renderTo(viewerRef.current, {
            width: '100%',
            height: '100%',
            spread: 'auto',
            allowScriptedContent: true,
        })

        // Apply writing mode before epub.js measures the document. Applying it
        // from the rendered event is too late: pagination has already selected
        // its axis by then.
        if (writingMode) {
            book.spine.hooks.content.register((document: Document) => {
                const root = document.documentElement
                root.style.setProperty('writing-mode', writingMode)
                root.style.setProperty('-webkit-writing-mode', writingMode)
                root.style.setProperty('direction', 'ltr')
            })
        }

        // Intercept and Purify
        rendition.hooks.content.register((contents: Contents) => {
            const body = contents.document.body

            // Clean the HTML but keep the structure
            const cleanHtml = sanitizeHTML(body.innerHTML, {
                // ESSENTIAL: Allow attributes needed for selection/EPUB styling
                ADD_ATTR: ['itemprop', 'role'],
                // FORBID: Scripts and event handlers (onmouseover, etc.)
                FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
                FORBID_ATTR: ['onerror', 'onclick', 'onload'],
            })

            body.innerHTML = cleanHtml
        })

        renditionRef.current = rendition
        lastReportedLocationRef.current = null

        // The reader can receive its final height one layout pass after
        // epub.js has created the rendition (notably outside fullscreen). Keep
        // pagination in sync with the actual viewport dimensions.
        let renditionAttached = false
        const resizeRendition = () => {
            if (renditionRef.current !== rendition || !renditionAttached) return

            const bounds = viewerRef.current?.getBoundingClientRect()
            if (!bounds?.width || !bounds.height) return

            rendition.resize(Math.round(bounds.width), Math.round(bounds.height))
        }
        const resizeObserver = new ResizeObserver(resizeRendition)
        resizeObserver.observe(viewerRef.current)

        const resizeAfterViewportChange = () => {
            requestAnimationFrame(() => {
                resizeRendition()
                window.setTimeout(resizeRendition, 100)
            })
        }
        const visualViewport = window.visualViewport
        window.addEventListener('resize', resizeAfterViewportChange)
        visualViewport?.addEventListener('resize', resizeAfterViewportChange)

        rendition.on('attached', () => {
            renditionAttached = true
            resizeAfterViewportChange()
        })

        book.ready.then(() => {
            setToc(book.navigation.toc)
        })

        if (location) {
            rendition.display(location.toString())
        } else {
            rendition.display()
        }

        rendition.on(
            'relocated',
            (loc: {
                start: { cfi: string; href: string; displayed: { page: number; total: number } }
            }) => {
                setIsLoaded(true)
                setCurrentHref(loc.start.href)
                setCurrentPage(loc.start.displayed.page)
                setTotalPages(loc.start.displayed.total)
                lastReportedLocationRef.current = loc.start.cfi
                onLocationChangeRef.current(loc.start.cfi)
            },
        )

        onRenditionRef.current?.(rendition)

        return () => {
            resizeObserver.disconnect()
            window.removeEventListener('resize', resizeAfterViewportChange)
            visualViewport?.removeEventListener('resize', resizeAfterViewportChange)
            renditionRef.current = null
            book.destroy()
        }
    }, [url, writingMode])

    useEffect(() => {
        if (!renditionRef.current || !location) return

        const nextLocation = location.toString()
        if (nextLocation === lastReportedLocationRef.current) {
            lastReportedLocationRef.current = null
            return
        }

        renditionRef.current.display(nextLocation)
    }, [location])

    // Auto-expand ToC parents of the active chapter
    useEffect(() => {
        if (!toc.length || !currentHref) return
        const base = hrefBase(currentHref)
        setExpandedIds(prev => {
            const next = new Set(prev)
            toc.forEach(topItem => {
                if (subtreeContains(topItem, base)) next.add(topItem.id)
            })
            return next
        })
    }, [currentHref, toc])

    const toggleExpand = useCallback((id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    const currentBase = hrefBase(currentHref)

    const chapterName = useMemo(() => findTocLabel(toc, currentBase), [toc, currentBase])

    const prev = useCallback(() => renditionRef.current?.prev(), [])
    const next = useCallback(() => renditionRef.current?.next(), [])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
                return
            if (e.key === 'ArrowLeft') isRTL ? next() : prev()
            else if (e.key === 'ArrowRight') isRTL ? prev() : next()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [isRTL, prev, next])

    const headerTitle = title && chapterName ? `${title} — ${chapterName}` : title

    return (
        <div className='group relative flex flex-col w-full h-full'>
            {/* Header */}
            <div className='flex items-center px-1 h-15 shrink-0'>
                <div className='flex-1'></div>
                <span className='min-w-2 px-2 text-primary-400 group-hover:text-primary-500 transition-colors text-sm text-center truncate select-none'>
                    {headerTitle}
                </span>
                <div className='flex flex-1 justify-end items-center gap-0.5 px-2 opacity-60 group-hover:opacity-100 transition-opacity'>
                    {actions}
                </div>
            </div>

            {/* Epub content + side nav buttons */}
            <div className='flex flex-1 min-h-0 overflow-hidden items-stretch'>
                {/* Previous page button */}
                <button
                    aria-label='Previous page'
                    onClick={isRTL ? next : prev}
                    className='flex items-center justify-start pl-2 w-10 sm:w-20 shrink-0 text-default-300 hover:text-default-500 active:text-default-600 transition-colors group'
                >
                    <CaretLeftIcon
                        weight='bold'
                        className='text-xl opacity-60 group-hover:opacity-100 group-active:opacity-100 transition-opacity'
                    />
                </button>

                {/* Epub viewer */}
                <div className='relative flex-1 min-w-0 min-h-0'>
                    {!isLoaded && (
                        <div className='z-10 absolute inset-0 flex justify-center items-center'>
                            <CircularProgress color='primary' size='lg' />
                        </div>
                    )}
                    <div ref={viewerRef} className='w-full h-full' />
                </div>

                {/* Next page button */}
                <button
                    aria-label='Next page'
                    onClick={isRTL ? prev : next}
                    className='flex items-center justify-end pr-2 w-10 sm:w-20 shrink-0 text-default-300 hover:text-default-500 active:text-default-600 transition-colors group'
                >
                    <CaretRightIcon
                        weight='bold'
                        className='text-xl opacity-60 group-hover:opacity-100 group-active:opacity-100 transition-opacity'
                    />
                </button>
            </div>

            {/* Page indicator footer */}
            {isLoaded && (
                <div className='flex items-center justify-center gap-1 pb-5 w-full text-primary-400 group-hover:text-primary-500 transition-colors select-none'>
                    {toc.length > 0 && <span aria-hidden className='h-6 w-6 shrink-0' />}
                    <span>
                        {currentPage}
                        <span className='text-primary-300'>&nbsp;/&nbsp;</span>
                        {totalPages}
                    </span>
                    {toc.length > 0 && <TocTrigger onPress={onOpen} />}
                </div>
            )}

            {/* Table of Contents */}
            <TocDrawer
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                title={tocTitle}
                items={toc}
                currentHref={currentHref}
                currentPage={currentPage}
                totalPages={totalPages}
                onSelect={href => renditionRef.current?.display(href)}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
                portalContainer={portalContainer}
            />
        </div>
    )
}
