'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { NavItem, Rendition } from 'epubjs'
import ePub from 'epubjs'
import {
    Drawer, DrawerContent, DrawerHeader, DrawerBody,
    Button, useDisclosure, cn,
} from '@heroui/react'
import { ListIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'

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
    epubOptions?: Record<string, boolean>
    portalContainer?: Element
    pageIndicator?: string
}

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
    epubOptions,
    portalContainer,
    pageIndicator,
}: EpubReaderProps) {
    const viewerRef = useRef<HTMLDivElement>(null)
    const renditionRef = useRef<Rendition | null>(null)
    const [isLoaded, setIsLoaded] = useState(false)
    const [toc, setToc] = useState<NavItem[]>([])
    const [currentHref, setCurrentHref] = useState('')
    const { isOpen, onOpen, onOpenChange } = useDisclosure()

    const onLocationChangeRef = useRef(onLocationChange)
    onLocationChangeRef.current = onLocationChange
    const onRenditionRef = useRef(onRendition)
    onRenditionRef.current = onRendition

    useEffect(() => {
        if (!viewerRef.current) return

        const book = ePub(url, epubOptions)
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

        rendition.on('relocated', (loc: { start: { cfi: string; href: string } }) => {
            setIsLoaded(true)
            setCurrentHref(loc.start.href)
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

    const prev = useCallback(() => renditionRef.current?.prev(), [])
    const next = useCallback(() => renditionRef.current?.next(), [])

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
                        onPress={onOpen}
                        className='text-default-500'
                    >
                        <ListIcon weight='bold' className='text-lg' />
                    </Button>
                </div>
                <span className='shrink-0 px-2 text-secondary-500 text-base text-center truncate select-none opacity-0 group-hover:opacity-100 transition-opacity'>
                    {title}
                </span>
                <div className='flex flex-1 justify-end items-center gap-0.5 px-2'>
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

            {/* page number indicator */}
            {isLoaded && (
                <div className='flex items-center justify-center text-secondary-500 pb-5 w-full opacity-0 group-hover:opacity-100 transition-opacity'>
                    {pageIndicator}
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
                            <DrawerHeader className='font-semibold text-base pl-4'>
                                {tocTitle}
                            </DrawerHeader>
                            <DrawerBody className='px-0 pb-8'>
                                <TocTree
                                    items={toc}
                                    currentHref={currentHref}
                                    onSelect={(href) => {
                                        renditionRef.current?.display(href)
                                        onClose()
                                    }}
                                />
                            </DrawerBody>
                        </>
                    )}
                </DrawerContent>
            </Drawer>
        </div>
    )
}

function TocTree({
    items,
    currentHref,
    onSelect,
    depth = 0,
}: {
    items: NavItem[]
    currentHref: string
    onSelect: (href: string) => void
    depth?: number
}) {
    return (
        <ul className='m-0 p-0 list-none'>
            {items.map((item) => {
                const itemBase = item.href.split('#')[0]
                const currentBase = currentHref.split('#')[0]
                const isActive = !!(itemBase && currentBase && (currentBase === itemBase || currentBase.endsWith('/' + itemBase)))
                return (
                    <li key={item.id}>
                        <button
                            className={cn(
                                'py-2.5 w-full text-sm text-left transition-colors',
                                isActive
                                    ? 'text-primary font-medium bg-primary-50/50'
                                    : 'text-foreground/80 hover:bg-default-100',
                            )}
                            style={{ paddingLeft: `${16 + depth * 16}px`, paddingRight: '16px' }}
                            onClick={() => onSelect(item.href)}
                        >
                            {item.label.trim()}
                        </button>
                        {item.subitems && item.subitems.length > 0 && (
                            <TocTree
                                items={item.subitems}
                                currentHref={currentHref}
                                onSelect={onSelect}
                                depth={depth + 1}
                            />
                        )}
                    </li>
                )
            })}
        </ul>
    )
}
