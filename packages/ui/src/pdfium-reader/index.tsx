'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPluginRegistration } from '@embedpdf/core'
import { EmbedPDF } from '@embedpdf/core/react'
import { usePdfiumEngine } from '@embedpdf/engines/react'
import {
    DocumentContent,
    DocumentManagerPluginPackage,
} from '@embedpdf/plugin-document-manager/react'
import {
    PagePointerProvider,
    InteractionManagerPluginPackage,
} from '@embedpdf/plugin-interaction-manager/react'
import { RenderLayer, RenderPluginPackage } from '@embedpdf/plugin-render/react'
import { Scroller, ScrollPluginPackage, useScroll } from '@embedpdf/plugin-scroll/react'
import {
    SelectionLayer,
    SelectionPluginPackage,
    useSelectionCapability,
} from '@embedpdf/plugin-selection/react'
import { Viewport, ViewportPluginPackage } from '@embedpdf/plugin-viewport/react'
import { ZoomMode, ZoomPluginPackage, useZoom } from '@embedpdf/plugin-zoom/react'
import { cn } from '@heroui/theme'

interface PdfiumReaderProps {
    url: string
    title?: string
    actions?: React.ReactNode
    dark?: boolean
    onLocationChange?: (page: string) => void
    onSelection?: (
        text: string,
        page: number,
        rect: { left: number; top: number; width: number; height: number },
    ) => void
    onSelectionClear?: () => void
}

const debugLog = (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
        console.debug('[pdfium]', ...args)
    }
}

/** Relays engine-native selection data to the host app. */
function SelectionBridge({
    documentId,
    onSelection,
    onClear,
}: {
    documentId: string
    onSelection?: PdfiumReaderProps['onSelection']
    onClear?: () => void
}) {
    const { provides } = useSelectionCapability()
    const { state: zoomState } = useZoom(documentId)
    const scaleRef = useRef(zoomState.currentZoomLevel)
    scaleRef.current = zoomState.currentZoomLevel

    useEffect(() => {
        if (!provides || !onSelection) return
        const scope = provides.forDocument(documentId)
        debugLog('selection bridge subscribed', { documentId })

        const emitSelection = (texts: string[]) => {
            const formatted = scope.getFormattedSelection()[0]
            debugLog('getSelectedText resolved', {
                texts,
                formatted,
                scale: scaleRef.current,
            })
            if (!formatted) return
            const page = document.querySelector<HTMLElement>(
                `[data-pdf-page="${formatted.pageIndex}"]`,
            )
            const scale = scaleRef.current || 1
            const pageRect = page?.getBoundingClientRect() ?? { left: 0, top: 0 }
            onSelection(texts.join('\n'), formatted.pageIndex + 1, {
                left: pageRect.left + formatted.rect.origin.x * scale,
                top: pageRect.top + formatted.rect.origin.y * scale,
                width: formatted.rect.size.width * scale,
                height: formatted.rect.size.height * scale,
            })
        }

        const offEnd = scope.onEndSelection(({ modeId }) => {
            debugLog('end selection', { modeId })
            scope.getSelectedText().wait(emitSelection, error =>
                debugLog('getSelectedText failed', error),
            )
        })
        const offChange = scope.onSelectionChange(selection => {
            debugLog('selection change', { hasSelection: !!selection })
            if (!selection) onClear?.()
        })

        return () => {
            offEnd()
            offChange()
        }
    }, [documentId, onSelection, onClear, provides])

    return null
}

/** Reports the rendered page width so the footer can match it. */
function PageFrame({
    documentId,
    pageIndex,
    width,
    height,
    onWidth,
}: {
    documentId: string
    pageIndex: number
    width: number
    height: number
    onWidth?: (width: number) => void
}) {
    useEffect(() => {
        if (pageIndex === 0) onWidth?.(width)
    }, [pageIndex, width, onWidth])

    return (
        <div
            data-pdf-page={pageIndex}
            className='relative mx-auto mb-6 bg-white shadow-sm'
            style={{ width, height }}
        >
            <PagePointerProvider documentId={documentId} pageIndex={pageIndex}>
                <RenderLayer
                    documentId={documentId}
                    pageIndex={pageIndex}
                    draggable={false}
                    className='pointer-events-none select-none'
                />
                <SelectionLayer documentId={documentId} pageIndex={pageIndex} />
            </PagePointerProvider>
        </div>
    )
}

/** Relays the engine-native scroll position to the host app. */
function ScrollBridge({
    documentId,
    onPageChange,
}: {
    documentId: string
    onPageChange: (page: number, total: number) => void
}) {
    const { state } = useScroll(documentId)

    useEffect(() => {
        onPageChange(state.currentPage + 1, state.totalPages)
    }, [state.currentPage, state.totalPages, onPageChange])

    return null
}

export default function PdfiumReader({
    url,
    title = '',
    actions,
    dark = false,
    onSelection,
    onSelectionClear,
    onLocationChange,
}: PdfiumReaderProps) {
    const { engine, isLoading, error } = usePdfiumEngine()
    const containerRef = useRef<HTMLDivElement>(null)
    const [pageWidth, setPageWidth] = useState<number | null>(null)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(0)

    const plugins = useMemo(
        () => [
            createPluginRegistration(DocumentManagerPluginPackage, {
                initialDocuments: [{ url, documentId: 'ebook' }],
            }),
            createPluginRegistration(ViewportPluginPackage, { viewportGap: 24 }),
            createPluginRegistration(ScrollPluginPackage, { defaultPageGap: 24 }),
            createPluginRegistration(RenderPluginPackage),
            createPluginRegistration(ZoomPluginPackage, {
                defaultZoomLevel: ZoomMode.FitWidth,
            }),
            createPluginRegistration(InteractionManagerPluginPackage),
            createPluginRegistration(SelectionPluginPackage),
        ],
        [url],
    )

    const handlePageChange = useMemo(
        () => (nextPage: number, total: number) => {
            setPage(nextPage)
            setTotalPages(total)
            onLocationChange?.(String(nextPage))
        },
        [onLocationChange],
    )

    if (isLoading || !engine) {
        return <div className='flex h-full items-center justify-center'>加载 PDF 引擎中……</div>
    }
    if (error) {
        return (
            <div className='flex h-full items-center justify-center text-danger'>{error.message}</div>
        )
    }

    return (
        <div ref={containerRef} className='group relative flex h-full min-h-0 flex-col'>
            <div className='flex h-15 shrink-0 items-center px-1'>
                <div className='flex-1' />
                <span className='truncate px-2 text-center text-sm text-primary-400'>{title}</span>
                <div className='flex flex-1 justify-end gap-0.5 px-2'>{actions}</div>
            </div>
            <EmbedPDF engine={engine} plugins={plugins}>
                {({ activeDocumentId }) =>
                    activeDocumentId && (
                        <DocumentContent documentId={activeDocumentId}>
                            {({ isLoaded, isLoading: documentLoading, isError }) => {
                                if (documentLoading) {
                                    return (
                                        <div className='flex flex-1 items-center justify-center'>
                                            加载 PDF 中……
                                        </div>
                                    )
                                }
                                if (isError) {
                                    return (
                                        <div className='flex flex-1 items-center justify-center text-danger'>
                                            无法加载 PDF
                                        </div>
                                    )
                                }
                                if (!isLoaded) return null
                                return (
                                    <>
                                        <SelectionBridge
                                            documentId={activeDocumentId}
                                            onSelection={onSelection}
                                            onClear={onSelectionClear}
                                        />
                                        <ScrollBridge
                                            documentId={activeDocumentId}
                                            onPageChange={handlePageChange}
                                        />
                                        <Viewport
                                            documentId={activeDocumentId}
                                            className={cn(
                                                'flex-1',
                                                dark ? 'bg-stone-950' : 'bg-background',
                                            )}
                                        >
                                            <Scroller
                                                documentId={activeDocumentId}
                                                renderPage={({ width, height, pageIndex }) => (
                                                    <PageFrame
                                                        documentId={activeDocumentId}
                                                        pageIndex={pageIndex}
                                                        width={width}
                                                        height={height}
                                                        onWidth={setPageWidth}
                                                    />
                                                )}
                                            />
                                        </Viewport>
                                    </>
                                )
                            }}
                        </DocumentContent>
                    )
                }
            </EmbedPDF>
            {totalPages > 0 && (
                <div
                    className='mx-auto shrink-0 border-x border-t border-default-200/60 py-3 text-center text-sm text-primary-400'
                    style={pageWidth ? { width: `${pageWidth}px` } : undefined}
                >
                    {page} / {totalPages}
                </div>
            )}
        </div>
    )
}
