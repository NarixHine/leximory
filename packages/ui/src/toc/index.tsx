'use client'

import { useMemo } from 'react'
import {
    Button,
    Drawer,
    DrawerBody,
    DrawerContent,
    DrawerHeader,
    Progress,
    ScrollShadow,
    cn,
} from '@heroui/react'
import {
    CaretDownIcon,
    CheckCircleIcon,
    CircleDashedIcon,
    RowsIcon,
} from '@phosphor-icons/react'

/** A single entry in a reader outline, shared by the EPUB and PDF readers. */
export interface TocItem {
    id: string
    href: string
    label: string
    subitems?: TocItem[]
}

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
            x: '100%',
            opacity: 0,
            transition: {
                duration: 0.5,
                ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
            },
        },
    },
}

export function hrefBase(href: string) {
    return href.split('#')[0]
}

export function hrefMatch(a: string, b: string) {
    return a === b || a.endsWith('/' + b) || b.endsWith('/' + a)
}

export function flattenTocItems(items: TocItem[]): TocItem[] {
    return items.flatMap(item => [item, ...flattenTocItems(item.subitems ?? [])])
}

export function findTocLabel(items: TocItem[], currentBase: string): string | null {
    for (const item of items) {
        const ib = hrefBase(item.href)
        if (hrefMatch(currentBase, ib)) return item.label.trim()
        if (item.subitems?.length) {
            const found = findTocLabel(item.subitems, currentBase)
            if (found) return found
        }
    }
    return null
}

export function subtreeContains(item: TocItem, currentBase: string): boolean {
    const ib = hrefBase(item.href)
    if (hrefMatch(currentBase, ib)) return true
    return item.subitems?.some(child => subtreeContains(child, currentBase)) ?? false
}

function getItemProgress(
    item: TocItem,
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

function TinyProgress({ value }: { value: number }) {
    const size = 16
    const stroke = 1.5
    const r = (size - stroke) / 2
    const circ = 2 * Math.PI * r

    if (value === 0) {
        return <CircleDashedIcon weight='thin' />
    }
    if (value >= 100) {
        return <CheckCircleIcon weight='thin' className='text-foreground/50' />
    }
    return (
        <svg
            width={size}
            height={size}
            className='shrink-0 -rotate-90'
            style={{ overflow: 'visible' }}
        >
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill='none'
                stroke='currentColor'
                strokeWidth={stroke}
                className='text-default-200'
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
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
    item: TocItem
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
            <Button
                fullWidth
                disableAnimation
                variant={isActive ? 'flat' : 'light'}
                onPress={() => (hasChildren ? toggleExpand(item.id) : onSelect(item.href))}
                className={cn(
                    'flex items-center gap-2.5 text-left transition-colors',
                    depth === 0 ? 'py-2.5' : 'py-2',
                )}
                style={{ paddingLeft: `${16 + depth * 14}px`, paddingRight: '16px' }}
            >
                <TinyProgress value={progress} />
                <span
                    className={cn(
                        'flex-1 leading-snug transition-colors truncate',
                        depth === 0 ? 'text-sm font-semibold' : 'text-xs font-normal',
                        isActive && 'text-primary-700',
                        isDone && !isActive && 'text-foreground/30',
                        !isDone && !isActive && 'text-foreground/80',
                    )}
                >
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
            </Button>

            {hasChildren && (
                <ul
                    className={cn(
                        'overflow-hidden list-none p-0 m-0',
                        isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0',
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

/**
 * Discreet outline trigger that sits beside the page indicator in a reader
 * footer. A hover background and pointer cursor make it read as clickable.
 */
export function TocTrigger({ onPress }: { onPress: () => void }) {
    return (
        <button
            type='button'
            aria-label='目录'
            title='目录'
            onClick={onPress}
            className='inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-current opacity-50 transition-colors hover:bg-default-100 hover:opacity-100 focus-visible:bg-default-100 focus-visible:opacity-100 active:bg-default-200 group-hover:opacity-100'
        >
            <RowsIcon className='text-sm' />
        </button>
    )
}

/** The right-side outline drawer, including the table of contents list. */
export function TocDrawer({
    isOpen,
    onOpenChange,
    title,
    items,
    currentHref,
    currentPage,
    totalPages,
    onSelect,
    expandedIds,
    toggleExpand,
    portalContainer,
}: {
    isOpen: boolean
    onOpenChange: (isOpen: boolean) => void
    title: string
    items: TocItem[]
    currentHref: string
    currentPage: number
    totalPages: number
    onSelect: (href: string) => void
    expandedIds: Set<string>
    toggleExpand: (id: string) => void
    portalContainer?: Element
}) {
    const flatHrefs = useMemo(() => flattenTocItems(items).map(t => hrefBase(t.href)), [items])
    const currentBase = hrefBase(currentHref)

    const overallProgress = useMemo(() => {
        if (!flatHrefs.length) return 0
        const curIdx = flatHrefs.findIndex(h => hrefMatch(h, currentBase))
        if (curIdx < 0) return 0
        return Math.round(
            ((curIdx + currentPage / Math.max(totalPages, 1)) / flatHrefs.length) * 100,
        )
    }, [flatHrefs, currentBase, currentPage, totalPages])

    return (
        <Drawer
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            placement='right'
            size='xs'
            motionProps={DRAWER_MOTION}
            portalContainer={portalContainer}
        >
            <DrawerContent>
                {onClose => (
                    <>
                        <DrawerHeader className='flex flex-col gap-3 px-4 pt-5 pb-3'>
                            <span className='font-semibold text-base leading-none'>{title}</span>
                            <Progress
                                value={overallProgress}
                                size='sm'
                                className='w-full'
                                color='secondary'
                            />
                        </DrawerHeader>

                        <DrawerBody className='px-0 pb-8'>
                            <ScrollShadow>
                                <ul className='m-0 p-0 list-none'>
                                    {items.map(item => (
                                        <TocEntry
                                            key={item.id || item.href}
                                            item={item}
                                            depth={0}
                                            flatHrefs={flatHrefs}
                                            currentBase={currentBase}
                                            currentPage={currentPage}
                                            totalPages={totalPages}
                                            onSelect={href => {
                                                onSelect(href)
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
    )
}
