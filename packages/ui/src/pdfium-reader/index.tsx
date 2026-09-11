'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PdfEngine, PdfPageGeometry, PdfTextRun, Rect } from '@embedpdf/models'
import { createPluginRegistration } from '@embedpdf/core'
import { EmbedPDF, useDocumentState } from '@embedpdf/core/react'
import { usePdfiumEngine } from '@embedpdf/engines/react'
import {
    DocumentContent,
    DocumentManagerPluginPackage,
} from '@embedpdf/plugin-document-manager/react'
import {
    PagePointerProvider,
    InteractionManagerPluginPackage,
    useInteractionManagerCapability,
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
import { Button, CircularProgress } from '@heroui/react'
import { cn } from '@heroui/theme'
import { PiArrowClockwise, PiWarningCircle } from 'react-icons/pi'

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
    highlights?: string[]
}

/** Human-readable explanations for the PDFium engine error codes. */
const PDF_ERROR_HINTS: Record<number, string> = {
    2: '文件不存在或已被删除。',
    3: '文件不是有效的 PDF，可能已损坏。',
    4: '该 PDF 受密码保护，需要密码才能打开。',
    5: '该 PDF 的安全设置禁止在浏览器中打开。',
    6: 'PDF 页面数据无法读取。',
    13: 'PDF 引擎无法解析该文件。',
}

/** A descriptive error surface shown when a PDF cannot be loaded. */
function PdfError({
    title,
    message,
    code,
    detail,
    onRetry,
}: {
    title: string
    message?: string | null
    code?: number
    detail?: unknown
    onRetry?: () => void
}) {
    const hint = code !== undefined ? PDF_ERROR_HINTS[code] : undefined
    const detailText =
        detail === undefined || detail === null
            ? null
            : typeof detail === 'string'
              ? detail
              : (() => {
                    try {
                        return JSON.stringify(detail, null, 2)
                    } catch {
                        return String(detail)
                    }
                })()

    return (
        <div className='flex flex-1 items-center justify-center p-6'>
            <div className='flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-danger-100 bg-danger-50/60 px-6 py-8 text-center dark:border-danger-500/20 dark:bg-danger-500/10'>
                <PiWarningCircle className='text-4xl text-danger' />
                <div className='flex flex-col gap-1'>
                    <p className='text-base font-semibold text-foreground'>{title}</p>
                    {message ? (
                        <p className='text-sm text-foreground-500'>{message}</p>
                    ) : null}
                    {hint ? <p className='text-sm text-foreground-500'>{hint}</p> : null}
                </div>
                {detailText ? (
                    <pre className='max-h-40 w-full overflow-auto rounded-lg bg-default-100/70 p-3 text-left text-xs leading-relaxed text-foreground-500'>
                        {detailText}
                    </pre>
                ) : null}
                {code !== undefined ? (
                    <p className='text-xs text-foreground-400'>错误代码：{code}</p>
                ) : null}
                {onRetry ? (
                    <Button
                        color='danger'
                        variant='flat'
                        radius='full'
                        startContent={<PiArrowClockwise />}
                        onPress={onRetry}
                    >
                        重试
                    </Button>
                ) : null}
            </div>
        </div>
    )
}

/**
 * A page projection that can be searched without whitespace getting in the way.
 *
 * `normalized` is the page text with Markdown/typographic noise folded out and
 * all whitespace removed. `offsets[i]` is the ORIGINAL PDF character index of
 * `normalized[i]`, so a match found here can be mapped back onto real glyph
 * geometry.
 *
 * Worked example (dummy data) — note the line break with no space between runs:
 *
 *   runs: [
 *     { charIndex: 0,  text: "Hello world" },   // H=0 e=1 l=2 l=3 o=4 ·=5 w=6 o=7 r=8 l=9 d=10
 *     { charIndex: 11, text: "\nagain" },       // \n=11 a=12 g=13 a=14 i=15 n=16
 *   ]
 *
 *   normalized → "Helloworldagain"
 *   offsets    → [ 0, 1, 2, 3, 4,    6, 7, 8, 9, 10, 12, 13, 14, 15, 16 ]
 *                  └───── "Hello world" ─────┘      └───── "\nagain" ─────┘
 *                  (index 5 and 11 are whitespace and are skipped)
 *
 * A saved quote of `"Hello world\nagain"` folds to `"Helloworldagain"`, matches
 * at index 0, and maps to original offsets `0..16` — spanning both runs.
 */
interface PageTextIndex {
    normalized: string
    offsets: number[]
}

/**
 * Folds a single character to a canonical form so saved quotes match the
 * engine's extracted text regardless of typographic punctuation differences.
 *
 * Dummy mappings:
 *   "’" → "'"      "“" → '"'      "–"/"—" → "-"
 *   "\u00A0" (NBSP) → " "          "\u200B" (zero-width) → "" (dropped)
 */
function foldChar(char: string): string {
    switch (char) {
        case '\u2018':
        case '\u2019':
        case '\u201B':
        case '\u2032':
            return "'"
        case '\u201C':
        case '\u201D':
        case '\u201F':
        case '\u2033':
            return '"'
        case '\u00A0':
            return ' '
        default:
            if (char >= '\u2010' && char <= '\u2015') return '-'
            if (char === '\u200B' || char === '\u200C' || char === '\u200D' || char === '\uFEFF') {
                return ''
            }
            return char
    }
}

/**
 * Normalizes a saved bookmark quote: strips Markdown escapes/emphasis, folds
 * punctuation, and removes all whitespace so line-wrapped PDF selections match
 * the extracted page text.
 */
function foldQuote(text: string): string {
    const unescaped = text
        .replace(/\\([!-/:-@[-`{-~])/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
    let result = ''
    for (const char of unescaped) {
        const folded = foldChar(char)
        if (folded === '' || /\s/.test(folded)) continue
        result += folded
    }
    return result
}

/**
 * Builds a whitespace-free page string plus an index map back to the original
 * character offsets used by the PDF text geometry. Removing whitespace makes
 * line breaks, missing spaces, and stray spaces between text runs irrelevant.
 */
function buildPageText(runs: PdfTextRun[]): PageTextIndex {
    const ordered = [...runs].sort((a, b) => a.charIndex - b.charIndex)
    let normalized = ''
    const offsets: number[] = []
    for (const run of ordered) {
        for (let i = 0; i < run.text.length; i++) {
            const folded = foldChar(run.text[i])
            if (folded === '' || /\s/.test(folded)) continue
            normalized += folded
            offsets.push(run.charIndex + i)
        }
    }
    return { normalized, offsets }
}

/**
 * Converts a page character range into per-line highlight rectangles.
 *
 * Dummy data for a quote that wraps across two visual lines:
 *
 *   geometry.runs: [
 *     { charStart: 0,  glyphs: [ {x:10, y:20, width:5, height:10}, ... ] },  // line 1
 *     { charStart: 40, glyphs: [ {x:10, y:34, width:5, height:10}, ... ] },  // line 2 (y jumped)
 *   ]
 *   from = 0, to = 60
 *
 *   → [
 *       { origin: { x: 10, y: 20 }, size: { width: …, height: 10 } },  // line 1 band
 *       { origin: { x: 10, y: 34 }, size: { width: …, height: 10 } },  // line 2 band
 *     ]
 *
 * Glyphs are grouped by a vertical jump (`glyph.y` differing by more than half
 * the previous glyph height), which is what separates wrapped lines.
 */
function characterRangeToRects(geo: PdfPageGeometry, from: number, to: number): Rect[] {
    const rects: Rect[] = []
    for (const run of geo.runs) {
        const runStart = run.charStart
        const runEnd = runStart + run.glyphs.length - 1
        if (runEnd < from || runStart > to) continue

        const startIndex = Math.max(from, runStart) - runStart
        const endIndex = Math.min(to, runEnd) - runStart

        let line: { minX: number; minY: number; maxX: number; maxY: number } | null = null
        let previousY: number | null = null
        let previousHeight = 0
        const flush = () => {
            if (line) {
                rects.push({
                    origin: { x: line.minX, y: line.minY },
                    size: { width: line.maxX - line.minX, height: line.maxY - line.minY },
                })
            }
            line = null
        }

        for (let i = startIndex; i <= endIndex; i++) {
            const glyph = run.glyphs[i]
            if (!glyph || glyph.flags === 2) continue
            if (line && previousY !== null && Math.abs(glyph.y - previousY) > previousHeight * 0.5) {
                flush()
            }
            if (!line) {
                line = {
                    minX: glyph.x,
                    minY: glyph.y,
                    maxX: glyph.x + glyph.width,
                    maxY: glyph.y + glyph.height,
                }
            } else {
                line.minX = Math.min(line.minX, glyph.x)
                line.minY = Math.min(line.minY, glyph.y)
                line.maxX = Math.max(line.maxX, glyph.x + glyph.width)
                line.maxY = Math.max(line.maxY, glyph.y + glyph.height)
            }
            previousY = glyph.y
            previousHeight = glyph.height
        }
        flush()
    }
    return rects
}

/** Resolves saved bookmark quotes into highlight rectangles for one page. */
function HighlightOverlay({
    engine,
    documentId,
    pageIndex,
    highlights,
    dark,
}: {
    engine: PdfEngine
    documentId: string
    pageIndex: number
    highlights: string[]
    dark: boolean
}) {
    const documentState = useDocumentState(documentId)
    const { state: zoomState } = useZoom(documentId)
    const [rects, setRects] = useState<Rect[]>([])

    useEffect(() => {
        const document = documentState?.document
        const page = document?.pages[pageIndex]
        const targets = highlights.map(foldQuote).filter(Boolean)
        if (!engine || !document || !page || targets.length === 0) {
            setRects([])
            return
        }

        let cancelled = false
        Promise.all([
            engine.getPageTextRuns(document, page).toPromise(),
            engine.getPageGeometry(document, page).toPromise(),
        ])
            .then(([textRuns, geometry]) => {
                if (cancelled) return
                const { normalized, offsets } = buildPageText(textRuns.runs)
                const found: Rect[] = []
                for (const target of targets) {
                    // Match in the whitespace-free space, then map back to the
                    // original character range before asking for glyph boxes.
                    //
                    // Dummy data:
                    //   target      → "Helloworldagain"
                    //   match       → start = 0, end = 14
                    //   from / to   → offsets[0] = 0, offsets[14] = 16
                    const start = normalized.indexOf(target)
                    if (start < 0) continue
                    const end = start + target.length - 1
                    const from = offsets[start]
                    const to = offsets[end]
                    if (from === undefined || to === undefined) continue
                    found.push(...characterRangeToRects(geometry, from, to))
                }
                setRects(found)
            })
            .catch(() => {
                if (!cancelled) setRects([])
            })

        return () => {
            cancelled = true
        }
    }, [engine, documentState?.document, pageIndex, highlights])

    if (rects.length === 0) return null
    const scale = zoomState?.currentZoomLevel || 1
    return (
        <>
            {rects.map((rect, index) => (
                <div
                    key={index}
                    className='pointer-events-none absolute'
                    style={{
                        left: rect.origin.x * scale,
                        top: rect.origin.y * scale,
                        width: rect.size.width * scale,
                        height: rect.size.height * scale,
                        backgroundColor: dark ? 'rgb(123 191 99 / 0.35)' : 'rgb(183 224 143 / 0.45)',
                        mixBlendMode: dark ? 'screen' : 'multiply',
                    }}
                />
            ))}
        </>
    )
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

        const emitSelection = (texts: string[]) => {
            const formatted = scope.getFormattedSelection()[0]
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

        const offEnd = scope.onEndSelection(() => {
            scope.getSelectedText().wait(emitSelection, () => {})
        })
        const offChange = scope.onSelectionChange(selection => {
            if (!selection) onClear?.()
        })

        // A browser-initiated scroll dispatches `pointercancel` instead of
        // `pointerup`, so the selection handler never ends the drag on its own.
        // Clearing here drops the partial selection left under the finger.
        const cancelSelection = () => scope.clear()
        document.addEventListener('pointercancel', cancelSelection)

        return () => {
            offEnd()
            offChange()
            document.removeEventListener('pointercancel', cancelSelection)
        }
    }, [documentId, onSelection, onClear, provides])

    return null
}

/**
 * Restores native touch scrolling.
 *
 * The interaction manager's default `pointerMode` captures raw touch events,
 * which sets `touch-action: none` on every page. On touch devices that blocks
 * momentum scrolling entirely and turns every finger drag into a marquee
 * selection. Re-registering the mode with `wantsRawTouch: false` clears that
 * inline style and lets the viewport scroll natively, while pointer events
 * (tap / double-tap word selection) keep working and a browser-initiated scroll
 * simply cancels the in-flight pointer stream.
 */
function TouchScrollBridge() {
    const { provides } = useInteractionManagerCapability()

    useEffect(() => {
        provides?.registerMode({
            id: 'pointerMode',
            scope: 'page',
            exclusive: false,
            cursor: 'auto',
            wantsRawTouch: false,
        })
    }, [provides])

    return null
}

/** Reports the rendered page width so the footer can match it. */
function PageFrame({
    engine,
    documentId,
    pageIndex,
    width,
    height,
    highlights,
    dark,
    onWidth,
}: {
    engine: PdfEngine
    documentId: string
    pageIndex: number
    width: number
    height: number
    highlights: string[]
    dark: boolean
    onWidth?: (width: number) => void
}) {
    useEffect(() => {
        if (pageIndex === 0) onWidth?.(width)
    }, [pageIndex, width, onWidth])

    return (
        <div
            data-pdf-page={pageIndex}
            className='relative mx-auto bg-white dark:bg-black'
            style={{ width, height }}
        >
            <PagePointerProvider documentId={documentId} pageIndex={pageIndex}>
                <RenderLayer
                    documentId={documentId}
                    pageIndex={pageIndex}
                    draggable={false}
                    className='pointer-events-none select-none dark:invert dark:hue-rotate-180'
                />
                <HighlightOverlay
                    engine={engine}
                    documentId={documentId}
                    pageIndex={pageIndex}
                    highlights={highlights}
                    dark={dark}
                />
                <SelectionLayer
                    documentId={documentId}
                    pageIndex={pageIndex}
                    textStyle={{
                        background: dark
                            ? 'rgb(156 168 171 / 0.35)'
                            : 'rgb(103 120 124 / 0.3)',
                    }}
                />
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
    highlights = [],
}: PdfiumReaderProps) {
    const { engine, isLoading, error } = usePdfiumEngine()
    const containerRef = useRef<HTMLDivElement>(null)
    const [pageWidth, setPageWidth] = useState<number | null>(null)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(0)
    const [buffer, setBuffer] = useState<ArrayBuffer | null>(null)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [attempt, setAttempt] = useState(0)

    // Fetching the file ourselves gives precise, user-facing errors (HTTP
    // status, network failure, wrong format) that the engine abstracts away.
    useEffect(() => {
        let cancelled = false
        setBuffer(null)
        setFetchError(null)
        void (async () => {
            try {
                const response = await fetch(url)
                if (!response.ok) {
                    throw new Error(
                        `下载文件失败：HTTP ${response.status} ${response.statusText || ''}`.trim(),
                    )
                }
                const data = await response.arrayBuffer()
                if (cancelled) return
                const header = new TextDecoder().decode(new Uint8Array(data.slice(0, 1024)))
                if (!header.includes('%PDF-')) {
                    throw new Error('文件内容不是有效的 PDF（未找到 %PDF- 文件头）。')
                }
                setBuffer(data)
            } catch (reason) {
                if (cancelled) return
                setFetchError(
                    reason instanceof Error ? reason.message : '下载文件时发生未知错误。',
                )
            }
        })()
        return () => {
            cancelled = true
        }
    }, [url, attempt])

    const filename = useMemo(() => {
        try {
            return decodeURIComponent(new URL(url, 'https://local').pathname.split('/').pop() ?? '')
        } catch {
            return 'ebook.pdf'
        }
    }, [url])

    const plugins = useMemo(
        () =>
            buffer
                ? [
                      createPluginRegistration(DocumentManagerPluginPackage, {
                          initialDocuments: [{ buffer, name: filename, documentId: 'ebook' }],
                      }),
                      createPluginRegistration(ViewportPluginPackage, { viewportGap: 0 }),
                      createPluginRegistration(ScrollPluginPackage, { defaultPageGap: 0 }),
                      createPluginRegistration(RenderPluginPackage),
                      createPluginRegistration(ZoomPluginPackage, {
                          defaultZoomLevel: ZoomMode.FitWidth,
                      }),
                      createPluginRegistration(InteractionManagerPluginPackage),
                      createPluginRegistration(SelectionPluginPackage, {
                          marquee: { enabled: false },
                      }),
                  ]
                : [],
        [buffer, filename],
    )

    const handlePageChange = useMemo(
        () => (nextPage: number, total: number) => {
            setPage(nextPage)
            setTotalPages(total)
            onLocationChange?.(String(nextPage))
        },
        [onLocationChange],
    )

    const header = (
        <div className='flex h-15 shrink-0 items-center px-1'>
            <div className='flex-1' />
            <span className='truncate px-2 text-center text-sm text-primary-400'>{title}</span>
            <div className='flex flex-1 justify-end gap-0.5 px-2'>{actions}</div>
        </div>
    )

    if (isLoading || !engine) {
        return (
            <div className='flex h-full flex-col'>
                {header}
                <div className='flex flex-1 items-center justify-center'>
                    <CircularProgress color='primary' size='lg' />
                </div>
            </div>
        )
    }
    if (error) {
        return (
            <div className='flex h-full flex-col'>
                {header}
                <PdfError
                    title='PDF 引擎加载失败'
                    message={error.message}
                    detail={String(error.stack ?? '')}
                />
            </div>
        )
    }
    if (fetchError) {
        return (
            <div className='flex h-full flex-col'>
                {header}
                <PdfError
                    title='无法加载 PDF'
                    message={fetchError}
                    onRetry={() => setAttempt(value => value + 1)}
                />
            </div>
        )
    }

    return (
        <div ref={containerRef} className='group relative flex h-full min-h-0 flex-col'>
            {header}
            {!buffer ? (
                <div className='flex flex-1 items-center justify-center'>
                    <CircularProgress color='primary' size='lg' />
                </div>
            ) : (
                <>
                    <EmbedPDF engine={engine} plugins={plugins}>
                        {({ activeDocumentId }) => (
                            <>
                                <TouchScrollBridge />
                                {activeDocumentId && (
                                    <DocumentContent documentId={activeDocumentId}>
                                        {({
                                            isLoaded,
                                            isLoading: documentLoading,
                                            isError,
                                            documentState,
                                        }) => {
                                            if (documentLoading) {
                                                return (
                                                    <div className='flex flex-1 items-center justify-center'>
                                                        <CircularProgress
                                                            color='primary'
                                                            size='lg'
                                                        />
                                                    </div>
                                                )
                                            }
                                            if (isError) {
                                                return (
                                                    <PdfError
                                                        title='无法加载 PDF'
                                                        message={documentState?.error}
                                                        code={documentState?.errorCode}
                                                        detail={documentState?.errorDetails}
                                                        onRetry={() =>
                                                            setAttempt(value => value + 1)
                                                        }
                                                    />
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
                                                            dark
                                                                ? 'bg-stone-950'
                                                                : 'bg-background',
                                                        )}
                                                    >
                                                        <Scroller
                                                            documentId={activeDocumentId}
                                                            renderPage={({
                                                                width,
                                                                height,
                                                                pageIndex,
                                                            }) => (
                                                                <PageFrame
                                                                    engine={engine}
                                                                    documentId={activeDocumentId}
                                                                    pageIndex={pageIndex}
                                                                    width={width}
                                                                    height={height}
                                                                    highlights={highlights}
                                                                    dark={dark}
                                                                    onWidth={setPageWidth}
                                                                />
                                                            )}
                                                        />
                                                    </Viewport>
                                                </>
                                            )
                                        }}
                                    </DocumentContent>
                                )}
                            </>
                        )}
                    </EmbedPDF>
                    {totalPages > 0 && (
                        <div
                            className='mx-auto shrink-0 border-x border-t border-default-200/60 py-3 text-center text-sm text-primary-400'
                            style={pageWidth ? { width: `${pageWidth}px` } : undefined}
                        >
                            {page} / {totalPages}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
