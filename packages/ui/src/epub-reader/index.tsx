'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { NavItem, Rendition } from 'epubjs'
import ePub from 'epubjs'
import {
    Drawer, DrawerContent, DrawerHeader, DrawerBody,
    Button, useDisclosure, cn,
    Progress,
    ScrollShadow,
} from '@heroui/react'
import { ListIcon, CaretLeftIcon, CaretRightIcon, CaretDownIcon } from '@phosphor-icons/react'
import { PiCheckCircleThin, PiCircleDashedThin } from 'react-icons/pi'

export type { Book, Rendition, NavItem, Contents, Location } from 'epubjs'

const DRAWER_MOTION = {
    variants: {
        enter: {
            x: 0,
            opacity: 1,
            transition: {
                duration: 0.5,
                ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
            },
        },
        exit: {
            x: '-100%',
            opacity: 0,
            transition: {
                duration: 0.5,
                ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
            },
        },
    },
}

export interface EpubReaderProps {
    url: string
    location: string | number
    onLocationChange: (epubcifi: string) => void
    getRendition?: (rendition: Rendition) => void
    isRTL?: boolean
    title?: string
    tocTitle?: string
    loadingView?: ReactNode
    actions?: ReactNode
    portalContainer?: Element
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function flattenNavItems(items: NavItem[]): NavItem[] {
    return items.flatMap(item => [item, ...flattenNavItems(item.subitems ?? [])])
}

function hrefBase(href: string) {
    return href.split('#')[0]
}

function hrefMatch(a: string, b: string) {
    return a === b || a.endsWith('/' + b) || b.endsWith('/' + a)
}

function findChapterLabel(items: NavItem[], currentBase: string): string | null {
    for (const item of items) {
        const ib = hrefBase(item.href)
        if (hrefMatch(currentBase, ib)) return item.label.trim()
        if (item.subitems?.length) {
            const found = findChapterLabel(item.subitems, currentBase)
            if (found) return found
        }
    }
    return null
}

function subtreeContains(item: NavItem, currentBase: string): boolean {
    const ib = hrefBase(item.href)
    if (hrefMatch(currentBase, ib)) return true
    return item.subitems?.some(child => subtreeContains(child, currentBase)) ?? false
}

function getItemProgress(
    item: NavItem,
    flatHrefs: string[],
    currentBase: string,
    currentPage: number,
    totalPages: number,
): number {
    const ib = hrefBase(item.href)
    if (hrefMatch(currentBase, ib)) {
        return totalPages > 0 ? Math.round((currentPage / Math.max(totalPages, 1)) * 100) : 0
    }
    const itemIdx = flatHrefs.findIndex(h => hrefMatch(h, ib))
    const curIdx = flatHrefs.findIndex(h => hrefMatch(h, currentBase))
    if (itemIdx < 0 || curIdx < 0) return 0
    return itemIdx < curIdx ? 100 : 0
}

// ─── TinyProgress ───────────────────────────────────────────────────────────

function TinyProgress({ value }: { value: number }) {
    const size = 16
    const stroke = 1.5
    const r = (size - stroke) / 2
    const circ = 2 * Math.PI * r

    if (value === 0) {
        return (
            <PiCircleDashedThin />
        )
    }
    if (value >= 100) {
        return (
            <PiCheckCircleThin className='text-foreground/50' />
        )
    }
    return (
        <svg width={size} height={size} className='shrink-0 -rotate-90' style={{ overflow: 'visible' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill='none' stroke='currentColor' strokeWidth={stroke} className='text-default-200' />
            <circle
                cx={size / 2} cy={size / 2} r={r}
                fill='none'
                stroke='currentColor'
                strokeWidth={stroke}
                strokeDasharray={circ}
                strokeDashoffset={circ - (value / 100) * circ}
                strokeLinecap='round'
                className='text-primary transition-all duration-700'
            />
        </svg>
    )
}

// ─── TocEntry ───────────────────────────────────────────────────────────────

function TocEntry({
    item,
    depth,
    flatHrefs,
    currentBase,
    currentPage,
    totalPages,
    onSelect,
    expandedIds,
    toggleExpand,
}: {
    item: NavItem
    depth: number
    flatHrefs: string[]
    currentBase: string
    currentPage: number
    totalPages: number
    onSelect: (href: string) => void
    expandedIds: Set<string>
    toggleExpand: (id: string) => void
}) {
    const hasChildren = (item.subitems?.length ?? 0) > 0
    const isExpanded = expandedIds.has(item.id)
    const ib = hrefBase(item.href)
    const isActive = hrefMatch(currentBase, ib)
    const progress = getItemProgress(item, flatHrefs, currentBase, currentPage, totalPages)
    const isDone = progress === 100 && !isActive

    return (
        <li>
            <button
                onClick={() => hasChildren ? toggleExpand(item.id) : onSelect(item.href)}
                className={cn(
                    'w-full flex items-center gap-2.5 text-left transition-colors',
                    depth === 0 ? 'py-2.5' : 'py-2',
                    isActive
                        ? 'bg-primary-50/60 dark:bg-primary-900/20'
                        : 'hover:bg-default-100',
                )}
                style={{ paddingLeft: `${16 + depth * 14}px`, paddingRight: '16px' }}
            >
                <TinyProgress value={progress} />
                <span className={cn(
                    'flex-1 leading-snug transition-colors truncate',
                    depth === 0 ? 'text-sm font-semibold' : 'text-xs font-normal',
                    isActive && 'text-primary-700',
                    isDone && !isActive && 'text-foreground/30',
                    !isDone && !isActive && 'text-foreground/80',
                )}>
                    {item.label.trim()}
                </span>
                {hasChildren && (
                    <CaretDownIcon
                        weight='bold'
                        className={cn(
                            'shrink-0 text-foreground-300 transition-transform duration-300 text-xs',
                            isExpanded && 'rotate-180',
                        )}
                    />
                )}
            </button>

            {hasChildren && (
                <ul
                    className={cn(
                        'overflow-hidden transition-all duration-300 ease-out list-none p-0 m-0',
                        isExpanded ? 'max-h-[9999px] opacity-100' : 'max-h-0 opacity-0',
                    )}
                >
                    {item.subitems!.map(child => (
                        <TocEntry
                            key={child.id}
                            item={child}
                            depth={depth + 1}
                            flatHrefs={flatHrefs}
                            currentBase={currentBase}
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onSelect={onSelect}
                            expandedIds={expandedIds}
                            toggleExpand={toggleExpand}
                        />
                    ))}
                </ul>
            )}
        </li>
    )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function EpubReader({
    url,
    location,
    onLocationChange,
    getRendition: onRendition,
    isRTL = false,
    title = '',
    tocTitle = '目录',
    loadingView,
    actions,
    portalContainer,
}: EpubReaderProps) {
    const viewerRef = useRef<HTMLDivElement>(null)
    const renditionRef = useRef<Rendition | null>(null)
    const [isLoaded, setIsLoaded] = useState(false)
    const [toc, setToc] = useState<NavItem[]>([])
    const [currentHref, setCurrentHref] = useState('')
    const [currentPage, setCurrentPage] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const { isOpen, onOpen, onOpenChange } = useDisclosure()
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

    const onLocationChangeRef = useRef(onLocationChange)
    onLocationChangeRef.current = onLocationChange
    const onRenditionRef = useRef(onRendition)
    onRenditionRef.current = onRendition

    useEffect(() => {
        if (!viewerRef.current) return

        const book = ePub(url)
        const rendition = book.renderTo(viewerRef.current, {
            width: '100%',
            height: '100%',
            spread: 'auto',
        })

        renditionRef.current = rendition

        book.ready.then(() => {
            setToc(book.navigation.toc)
        })

        if (location) {
            rendition.display(location.toString())
        } else {
            rendition.display()
        }

        rendition.on('relocated', (loc: { start: { cfi: string; href: string; displayed: { page: number; total: number } } }) => {
            setIsLoaded(true)
            setCurrentHref(loc.start.href)
            setCurrentPage(loc.start.displayed.page)
            setTotalPages(loc.start.displayed.total)
            onLocationChangeRef.current(loc.start.cfi)
        })

        onRenditionRef.current?.(rendition)

        return () => {
            renditionRef.current = null
            book.destroy()
        }
    }, [url])

    useEffect(() => {
        if (renditionRef.current && location) {
            renditionRef.current.display(location.toString())
        }
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

    const flatHrefs = useMemo(
        () => flattenNavItems(toc).map(t => hrefBase(t.href)),
        [toc],
    )

    const currentBase = hrefBase(currentHref)

    const chapterName = useMemo(
        () => findChapterLabel(toc, currentBase),
        [toc, currentBase],
    )

    const overallProgress = useMemo(() => {
        if (!flatHrefs.length) return 0
        const curIdx = flatHrefs.findIndex(h => hrefMatch(h, currentBase))
        if (curIdx < 0) return 0
        return Math.round(((curIdx + (currentPage / Math.max(totalPages, 1))) / flatHrefs.length) * 100)
    }, [flatHrefs, currentBase, currentPage, totalPages])

    const prev = useCallback(() => renditionRef.current?.prev(), [])
    const next = useCallback(() => renditionRef.current?.next(), [])

    const headerTitle = title && chapterName ? `${title} — ${chapterName}` : title

    return (
        <div className='group relative flex flex-col w-full h-full'>
            {/* Header */}
            <div className='flex items-center px-1 h-15 shrink-0'>
                <div className='flex-1'>
                    <Button
                        isIconOnly
                        variant='light'
                        radius='full'
                        size='lg'
                        color='secondary'
                        onPress={onOpen}
                        className='opacity-60 group-hover:opacity-100 transition-opacity'
                    >
                        <ListIcon weight='bold' className='text-lg' />
                    </Button>
                </div>
                <span className='min-w-2 px-2 text-secondary-500 text-sm text-center truncate select-none opacity-0 group-hover:opacity-100 transition-opacity'>
                    {headerTitle}
                </span>
                <div className='flex flex-1 justify-end items-center gap-0.5 px-2 opacity-60 group-hover:opacity-100 transition-opacity'>
                    {actions}
                </div>
            </div>

            {/* Epub content */}
            <div className='relative flex-1 min-h-0'>
                {!isLoaded && loadingView && (
                    <div className='z-10 absolute inset-0 flex justify-center items-center'>
                        {loadingView}
                    </div>
                )}
                <div ref={viewerRef} className='w-full h-full' />

                {/* Page navigation — full-height side buttons */}
                <button
                    aria-label='Previous page'
                    onClick={isRTL ? next : prev}
                    className='absolute top-0 left-0 z-20 flex items-center justify-start w-16 h-full pl-1 text-default-300 hover:text-default-500 active:text-default-600 transition-colors group'
                >
                    <CaretLeftIcon weight='bold' className='text-xl opacity-60 group-hover:opacity-100 group-active:opacity-100 transition-opacity' />
                </button>
                <button
                    aria-label='Next page'
                    onClick={isRTL ? prev : next}
                    className='absolute top-0 right-0 z-20 flex items-center justify-end w-16 h-full pr-1 text-default-300 hover:text-default-500 active:text-default-600 transition-colors group'
                >
                    <CaretRightIcon weight='bold' className='text-xl opacity-60 group-hover:opacity-100 group-active:opacity-100 transition-opacity' />
                </button>
            </div>

            {/* Page indicator footer */}
            {isLoaded && (
                <div className='flex items-center justify-center pb-5 w-full text-secondary-500 select-none opacity-0 group-hover:opacity-100 transition-opacity'>
                    <span>{currentPage}<span className='text-secondary-300'>&nbsp;/&nbsp;</span>{totalPages}</span>
                </div>
            )}

            {/* Table of Contents */}
            <Drawer
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                placement='left'
                size='xs'
                motionProps={DRAWER_MOTION}
                portalContainer={portalContainer}
            >
                <DrawerContent>
                    {(onClose) => (
                        <>
                            <DrawerHeader className='flex flex-col gap-3 px-4 pt-5 pb-3'>
                                <span className='font-semibold text-base leading-none'>{tocTitle}</span>
                                <Progress value={overallProgress} size='sm' className='w-full' color='secondary' />
                            </DrawerHeader>

                            <DrawerBody className='px-0 py-2'>
                                <ScrollShadow>
                                    <ul className='m-0 p-0 list-none'>
                                        {toc.map(item => (
                                            <TocEntry
                                                key={item.id || item.href}
                                                item={item}
                                                depth={0}
                                                flatHrefs={flatHrefs}
                                                currentBase={currentBase}
                                                currentPage={currentPage}
                                                totalPages={totalPages}
                                                onSelect={(href) => {
                                                    renditionRef.current?.display(href)
                                                    onClose()
                                                }}
                                                expandedIds={expandedIds}
                                                toggleExpand={toggleExpand}
                                            />
                                        ))}
                                    </ul>
                                </ScrollShadow>
                            </DrawerBody>
                        </>
                    )}
                </DrawerContent>
            </Drawer>
        </div>
    )
}
