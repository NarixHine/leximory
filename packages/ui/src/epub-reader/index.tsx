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
            spread: 'none',
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
        <div className="relative flex flex-col w-full h-full">
            {/* Header */}
            <div className="flex items-center shrink-0 h-10 px-1">
                <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    radius="full"
                    onPress={onOpen}
                    className="text-default-500"
                >
                    <ListIcon weight="bold" className="text-lg" />
                </Button>
                <span className="flex-1 text-center text-sm truncate px-2 text-default-400 select-none">
                    {title}
                </span>
                <div className="flex items-center gap-0.5">
                    {actions}
                </div>
            </div>

            {/* Epub content */}
            <div className="flex-1 relative min-h-0">
                {!isLoaded && loadingView && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center">
                        {loadingView}
                    </div>
                )}
                <div ref={viewerRef} className="epub-view w-full h-full" />

                {/* Previous page */}
                <button
                    className="absolute top-0 left-0 w-1/5 h-full flex items-center justify-start pl-2 group cursor-default appearance-none bg-transparent border-none outline-none"
                    onClick={isRTL ? next : prev}
                    tabIndex={-1}
                >
                    <CaretLeftIcon
                        weight="bold"
                        className="text-default-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    />
                </button>

                {/* Next page */}
                <button
                    className="absolute top-0 right-0 w-1/5 h-full flex items-center justify-end pr-2 group cursor-default appearance-none bg-transparent border-none outline-none"
                    onClick={isRTL ? prev : next}
                    tabIndex={-1}
                >
                    <CaretRightIcon
                        weight="bold"
                        className="text-default-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    />
                </button>
            </div>

            {/* Table of Contents */}
            <Drawer
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                placement="bottom"
                size="lg"
                backdrop="blur"
                classNames={{ base: 'rounded-t-2xl' }}
            >
                <DrawerContent>
                    {(onClose) => (
                        <>
                            <DrawerHeader className="font-medium text-base">
                                {tocTitle}
                            </DrawerHeader>
                            <DrawerBody className="px-0 pb-8">
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
        <ul className="list-none m-0 p-0">
            {items.map((item) => {
                const itemBase = item.href.split('#')[0]
                const currentBase = currentHref.split('#')[0]
                const isActive = !!(itemBase && currentBase && (currentBase === itemBase || currentBase.endsWith('/' + itemBase)))
                return (
                    <li key={item.id}>
                        <button
                            className={cn(
                                'w-full text-left py-2.5 text-sm transition-colors',
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
