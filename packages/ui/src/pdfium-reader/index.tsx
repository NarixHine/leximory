'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type {
    PdfBookmarkObject,
    PdfEngine,
    PdfPageGeometry,
    PdfTextRun,
    Rect,
} from '@embedpdf/models'
import { PdfActionType } from '@embedpdf/models'
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
import {
    Scroller,
    ScrollPluginPackage,
    useScroll,
    useScrollCapability,
} from '@embedpdf/plugin-scroll/react'
import {
    SelectionLayer,
    SelectionPluginPackage,
    useSelectionCapability,
} from '@embedpdf/plugin-selection/react'
import {
    Viewport,
    ViewportPluginPackage,
    useViewportElement,
} from '@embedpdf/plugin-viewport/react'
import { ZoomMode, ZoomPluginPackage, useZoom } from '@embedpdf/plugin-zoom/react'
import {
    Button,
    CircularProgress,
    Drawer,
    DrawerBody,
    DrawerContent,
    DrawerHeader,
    ScrollShadow,
    useDisclosure,
} from '@heroui/react'
import { cn } from '@heroui/theme'
import { PiArrowClockwise, PiCaretDown, PiListBullets, PiWarningCircle } from 'react-icons/pi'

interface PdfiumReaderProps {
    url: string
    title?: string
    actions?: React.ReactNode
    dark?: boolean
    /** 1-based page to restore to once the document first lays out. */
    initialPage?: number
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

/** Per-millisecond velocity retention; ~0.9975 is an iOS-like glide length. */
const PAN_DECELERATION = 0.9975
/** Only pointer samples within this window contribute to the fling velocity. */
const PAN_VELOCITY_WINDOW_MS = 90
/** Releasing after this long without movement is a stop, not a fling. */
const PAN_STALE_SAMPLE_MS = 70
/** Below this the glide is over (px/ms). */
const PAN_MIN_FLING_VELOCITY = 0.05
/** Ceiling so a hard flick cannot launch the page into orbit (px/ms). */
const PAN_MAX_FLING_VELOCITY = 3.5
/** How long restore keeps re-asserting to outlast the initial fit-width zoom. */
const PAN_RESTORE_SETTLE_MS = 700

/**
 * Enables one-finger text selection and two-finger scrolling at the same time.
 *
 * The interaction manager's `pointerMode` keeps `touch-action: none` on the page
 * so a single-finger drag reaches the selection handler instead of the browser.
 * That also disables native touch scrolling, so two-finger panning is driven
 * here in JavaScript:
 *
 * - The first finger down may start a selection; the moment a second finger
 *   lands we cancel it and pause interaction so the drag never becomes a
 *   selection.
 * - While two fingers move, we translate the viewport by the centroid delta,
 *   which tracks the fingers 1:1.
 * - On release the recent centroid samples give a velocity, and an exponential
 *   decay glide carries the scroll to a natural stop (`PAN_DECELERATION`). The
 *   glide renders in a rAF loop integrating velocity over real elapsed time, so
 *   it is frame-rate independent and survives high-refresh displays.
 * - Touching the page mid-glide ends it immediately (as on iOS), and
 *   interaction resumes so the next lone finger selects again.
 *
 * Rendered inside `<Viewport>` so it can borrow the scroll container element.
 */
function TwoFingerPan({ documentId }: { documentId: string }) {
    const viewportElement = useViewportElement()
    const { provides: interaction } = useInteractionManagerCapability()
    const { provides: selection } = useSelectionCapability()

    useEffect(() => {
        const element = viewportElement?.current
        if (!element) return

        const pointers = new Map<number, { x: number; y: number }>()
        const history: { x: number; y: number; t: number }[] = []
        let lastCentroid: { x: number; y: number } | null = null
        let panning = false

        // Momentum state. `posX/posY` are float accumulators so sub-pixel deltas
        // are not lost to integer `scrollTop` reads during the glide.
        let rafId = 0
        let velocityX = 0
        let velocityY = 0
        let posX = 0
        let posY = 0
        let lastFrame = 0

        const centroid = () => {
            const points = [...pointers.values()]
            if (points.length === 0) return null
            let x = 0
            let y = 0
            for (const point of points) {
                x += point.x
                y += point.y
            }
            return { x: x / points.length, y: y / points.length }
        }

        const stopMomentum = (resumeInteraction: boolean) => {
            if (!rafId) return
            cancelAnimationFrame(rafId)
            rafId = 0
            velocityX = 0
            velocityY = 0
            if (resumeInteraction) interaction?.forDocument(documentId).resume()
        }

        const tick = (now: number) => {
            rafId = 0
            // Clamp the step so a dropped frame (tab switch, jank) cannot teleport.
            const dt = Math.min(now - lastFrame, 48)
            lastFrame = now

            posX += velocityX * dt
            posY += velocityY * dt

            const maxX = element.scrollWidth - element.clientWidth
            const maxY = element.scrollHeight - element.clientHeight
            if (posX <= 0) {
                posX = 0
                velocityX = 0
            } else if (posX >= maxX) {
                posX = maxX
                velocityX = 0
            }
            if (posY <= 0) {
                posY = 0
                velocityY = 0
            } else if (posY >= maxY) {
                posY = maxY
                velocityY = 0
            }

            element.scrollLeft = posX
            element.scrollTop = posY

            const decay = Math.pow(PAN_DECELERATION, dt)
            velocityX *= decay
            velocityY *= decay

            if (
                Math.abs(velocityX) < PAN_MIN_FLING_VELOCITY &&
                Math.abs(velocityY) < PAN_MIN_FLING_VELOCITY
            ) {
                interaction?.forDocument(documentId).resume()
                return
            }
            rafId = requestAnimationFrame(tick)
        }

        const startMomentum = (vx: number, vy: number) => {
            velocityX = vx
            velocityY = vy
            posX = element.scrollLeft
            posY = element.scrollTop
            lastFrame = performance.now()
            rafId = requestAnimationFrame(tick)
        }

        /** Average centroid velocity over the sample window, in scroll space. */
        const flingVelocity = () => {
            const last = history[history.length - 1]
            if (history.length < 2 || !last) return { vx: 0, vy: 0 }
            if (performance.now() - last.t > PAN_STALE_SAMPLE_MS) return { vx: 0, vy: 0 }
            const first = history.find(sample => last.t - sample.t <= PAN_VELOCITY_WINDOW_MS)
            if (!first) return { vx: 0, vy: 0 }
            const dt = last.t - first.t
            if (dt <= 0) return { vx: 0, vy: 0 }

            // Scroll moves opposite the fingers, hence the negation.
            let vx = -(last.x - first.x) / dt
            let vy = -(last.y - first.y) / dt
            const speed = Math.hypot(vx, vy)
            if (speed > PAN_MAX_FLING_VELOCITY) {
                const scale = PAN_MAX_FLING_VELOCITY / speed
                vx *= scale
                vy *= scale
            }
            return { vx, vy }
        }

        const onPointerDown = (event: PointerEvent) => {
            // Touching the moving page halts the glide, like iOS.
            stopMomentum(true)
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

            if (pointers.size < 2) return
            if (!panning) {
                panning = true
                history.length = 0
                selection?.forDocument(documentId).clear()
                interaction?.forDocument(documentId).pause()
            }
            // Re-anchor when the finger count changes so the centroid does not jump.
            lastCentroid = centroid()
        }

        const onPointerMove = (event: PointerEvent) => {
            if (!pointers.has(event.pointerId)) return
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
            if (!panning || pointers.size < 2 || !lastCentroid) return

            const next = centroid()
            if (!next) return
            const dx = next.x - lastCentroid.x
            const dy = next.y - lastCentroid.y
            lastCentroid = next

            const t = performance.now()
            history.push({ x: next.x, y: next.y, t })
            while (history.length > 1 && t - history[0].t > PAN_VELOCITY_WINDOW_MS) {
                history.shift()
            }

            // Scroll the element directly rather than via the viewport
            // capability: `scrollTo` defers to a rAF and reading it back returns
            // a stale position, so chained deltas were dropped and the gesture
            // felt laggy. Writing `scrollTop` here is synchronous and 1:1 with
            // the fingers; the viewport's own scroll listener still syncs state.
            element.scrollLeft -= dx
            element.scrollTop -= dy
        }

        const onPointerEnd = (event: PointerEvent) => {
            pointers.delete(event.pointerId)
            if (!panning) return

            // Dropping from two fingers to one keeps the pan paused until the
            // last lift, but does not itself fling.
            if (pointers.size >= 1) {
                lastCentroid = centroid()
                return
            }

            panning = false
            lastCentroid = null
            const { vx, vy } = flingVelocity()
            if (Math.hypot(vx, vy) >= PAN_MIN_FLING_VELOCITY) {
                startMomentum(vx, vy)
            } else {
                selection?.forDocument(documentId).clear()
                interaction?.forDocument(documentId).resume()
            }
        }

        const onWheel = () => stopMomentum(true)

        element.addEventListener('pointerdown', onPointerDown)
        element.addEventListener('pointermove', onPointerMove)
        element.addEventListener('pointerup', onPointerEnd)
        element.addEventListener('pointercancel', onPointerEnd)
        element.addEventListener('wheel', onWheel, { passive: true })

        return () => {
            element.removeEventListener('pointerdown', onPointerDown)
            element.removeEventListener('pointermove', onPointerMove)
            element.removeEventListener('pointerup', onPointerEnd)
            element.removeEventListener('pointercancel', onPointerEnd)
            element.removeEventListener('wheel', onWheel)
            if (rafId) cancelAnimationFrame(rafId)
            interaction?.forDocument(documentId).resume()
        }
    }, [viewportElement, interaction, selection, documentId])

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
                            ? 'rgb(156 168 171 / 0.5)'
                            : 'rgb(103 120 124 / 0.3)',
                    }}
                />
            </PagePointerProvider>
        </div>
    )
}

/**
 * Relays the engine-native scroll position to the host app and restores the
 * last-read page once the document has laid out.
 *
 * Two timing hazards shape this:
 *
 * 1. The restored page arrives through a storage-backed atom, which can hydrate
 *    a tick after mount, so the target is tracked in a ref and the settle loop
 *    keeps re-reading it instead of locking in the first (possibly empty) value.
 * 2. The scroller's geometry needs the final fit-width scale, which is
 *    recalculated shortly after the first layout and scrolls back to the top.
 *    The restore therefore re-asserts for a short window; a timer (not rAF) is
 *    used so it still lands when the tab is backgrounded, and any touch or wheel
 *    stops it so it never fights the reader.
 *
 * Reporting stays silent until the restore has finished so the placeholder page
 * count on mount cannot overwrite the stored position.
 */
function ScrollBridge({
    documentId,
    initialPage,
    onPageChange,
}: {
    documentId: string
    initialPage?: number
    onPageChange: (page: number, total: number) => void
}) {
    const { state } = useScroll(documentId)
    const { provides: scroll } = useScrollCapability()
    const targetRef = useRef(0)
    const [restored, setRestored] = useState(false)

    if (!restored && initialPage !== undefined) {
        targetRef.current = Math.round(initialPage)
    }

    useEffect(() => {
        if (!scroll || restored) return
        const scope = scroll.forDocument(documentId)
        let stopped = false
        let timer = 0
        const start = performance.now()

        const apply = () => {
            const target = targetRef.current
            if (target <= 1) return false
            if (scope.getLayout().virtualItems.length === 0) return false
            scope.scrollToPage({ pageNumber: target, behavior: 'instant' })
            return true
        }

        const finish = () => {
            stopped = true
            window.clearTimeout(timer)
            setRestored(true)
        }

        const loop = () => {
            if (stopped) return
            // A successful scroll only proves that a layout exists. The
            // fit-width recalculation that follows can still reset the
            // viewport to page 1, so keep applying the saved page for the
            // complete settle window.
            apply()
            if (performance.now() - start >= PAN_RESTORE_SETTLE_MS) {
                finish()
                return
            }
            timer = window.setTimeout(loop, 16)
        }

        const layoutReady = scroll.onLayoutReady(event => {
            if (event.documentId === documentId) apply()
        })
        const layoutChange = scroll.onLayoutChange(event => {
            if (event.documentId === documentId) apply()
        })

        document.addEventListener('pointerdown', finish, { once: true })
        document.addEventListener('wheel', finish, { once: true, passive: true })

        timer = window.setTimeout(loop, 0)

        return () => {
            stopped = true
            window.clearTimeout(timer)
            layoutReady()
            layoutChange()
            document.removeEventListener('pointerdown', finish)
            document.removeEventListener('wheel', finish)
        }
    }, [scroll, documentId, restored])

    useEffect(() => {
        if (!restored) return
        if (state.totalPages <= 1) return
        // `currentPage` is already 1-based (`scrollToPage` uses pageNumber as-is).
        onPageChange(state.currentPage, state.totalPages)
    }, [restored, state.currentPage, state.totalPages, onPageChange])

    return null
}

/** Resolves the 0-based page a PDF bookmark points at, if it has a usable target. */
function bookmarkPageIndex(bookmark: PdfBookmarkObject): number | null {
    const target = bookmark.target
    if (!target) return null
    if (target.type === 'destination') return target.destination.pageIndex
    const action = target.action
    if (action.type === PdfActionType.Goto || action.type === PdfActionType.RemoteGoto) {
        return action.destination.pageIndex
    }
    return null
}

/** One row of the PDF outline; parents expand in place, leaves jump to their page. */
function PdfTocEntry({
    item,
    path,
    depth,
    expanded,
    toggle,
    onSelect,
}: {
    item: PdfBookmarkObject
    path: string
    depth: number
    expanded: Set<string>
    toggle: (path: string) => void
    onSelect: (pageIndex: number) => void
}) {
    const children = item.children ?? []
    const hasChildren = children.length > 0
    const isExpanded = expanded.has(path)
    const pageIndex = bookmarkPageIndex(item)
    const label = item.title.trim() || '未命名章节'

    return (
        <li>
            <div
                className='flex items-center gap-1 pr-3 transition-colors hover:bg-default-100'
                style={{ paddingLeft: `${12 + depth * 14}px` }}
            >
                <button
                    type='button'
                    onClick={() => {
                        if (pageIndex !== null) onSelect(pageIndex)
                        else if (hasChildren) toggle(path)
                    }}
                    className={cn(
                        'flex-1 truncate py-2 text-left leading-snug',
                        depth === 0 ? 'text-sm font-medium' : 'text-xs',
                        pageIndex === null && !hasChildren
                            ? 'text-foreground-400'
                            : 'text-foreground-700',
                    )}
                >
                    {label}
                </button>
                {hasChildren && (
                    <button
                        type='button'
                        aria-label={isExpanded ? '收起' : '展开'}
                        onClick={() => toggle(path)}
                        className='shrink-0 rounded p-1 text-foreground-400 transition-colors hover:text-foreground-600'
                    >
                        <PiCaretDown
                            className={cn(
                                'text-xs transition-transform',
                                isExpanded && 'rotate-180',
                            )}
                        />
                    </button>
                )}
            </div>
            {hasChildren && isExpanded && (
                <ul className='m-0 list-none p-0'>
                    {children.map((child, index) => (
                        <PdfTocEntry
                            key={`${path}-${index}`}
                            item={child}
                            path={`${path}-${index}`}
                            depth={depth + 1}
                            expanded={expanded}
                            toggle={toggle}
                            onSelect={onSelect}
                        />
                    ))}
                </ul>
            )}
        </li>
    )
}

/** A collapsible outline tree, hidden entirely when the document has no outline. */
function PdfTocList({
    bookmarks,
    onSelect,
}: {
    bookmarks: PdfBookmarkObject[]
    onSelect: (pageIndex: number) => void
}) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const toggle = (path: string) =>
        setExpanded(previous => {
            const next = new Set(previous)
            if (next.has(path)) next.delete(path)
            else next.add(path)
            return next
        })

    return (
        <ul className='m-0 list-none p-0'>
            {bookmarks.map((item, index) => (
                <PdfTocEntry
                    key={index}
                    item={item}
                    path={String(index)}
                    depth={0}
                    expanded={expanded}
                    toggle={toggle}
                    onSelect={onSelect}
                />
            ))}
        </ul>
    )
}

/**
 * Reads the document outline from the engine and exposes a jump-to-page handle.
 *
 * The fetch runs once the document object exists and is cached in the parent so
 * the footer's ToC affordance only appears when there is an outline to show.
 */
function TocBridge({
    engine,
    documentId,
    onBookmarks,
    navigateRef,
}: {
    engine: PdfEngine
    documentId: string
    onBookmarks: (bookmarks: PdfBookmarkObject[]) => void
    navigateRef: React.RefObject<((pageIndex: number) => void) | null>
}) {
    const documentState = useDocumentState(documentId)
    const { provides: scroll } = useScrollCapability()

    useEffect(() => {
        const document = documentState?.document
        if (!document) return
        let cancelled = false
        engine
            .getBookmarks(document)
            .toPromise()
            .then(result => {
                if (!cancelled) onBookmarks(result.bookmarks ?? [])
            })
            .catch(() => {
                if (!cancelled) onBookmarks([])
            })
        return () => {
            cancelled = true
        }
    }, [engine, documentState?.document, onBookmarks])

    useEffect(() => {
        if (!scroll) return
        const scope = scroll.forDocument(documentId)
        navigateRef.current = (pageIndex: number) =>
            scope.scrollToPage({ pageNumber: pageIndex + 1, behavior: 'smooth' })
        return () => {
            navigateRef.current = null
        }
    }, [scroll, documentId, navigateRef])

    return null
}

export default function PdfiumReader({
    url,
    title = '',
    actions,
    dark = false,
    initialPage,
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
    const [bookmarks, setBookmarks] = useState<PdfBookmarkObject[]>([])
    const navigateRef = useRef<((pageIndex: number) => void) | null>(null)
    const { isOpen, onOpen, onOpenChange } = useDisclosure()

    // Fetching the file ourselves gives precise, user-facing errors (HTTP
    // status, network failure, wrong format) that the engine abstracts away.
    useEffect(() => {
        let cancelled = false
        setBuffer(null)
        setFetchError(null)
        setBookmarks([])
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
        <div
            ref={containerRef}
            className='group relative flex h-full min-h-0 select-none flex-col'
        >
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
                                                        initialPage={initialPage}
                                                        onPageChange={handlePageChange}
                                                    />
                                                    <TocBridge
                                                        engine={engine}
                                                        documentId={activeDocumentId}
                                                        onBookmarks={setBookmarks}
                                                        navigateRef={navigateRef}
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
                                                        <TwoFingerPan
                                                            documentId={activeDocumentId}
                                                        />
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
                            className='relative mx-auto flex shrink-0 items-center justify-center border-x border-t border-default-200/60 py-3 text-center text-sm text-primary-400'
                            style={pageWidth ? { width: `${pageWidth}px` } : undefined}
                        >
                            <span>
                                {page} / {totalPages}
                            </span>
                            {bookmarks.length > 0 && (
                                <button
                                    type='button'
                                    aria-label='目录'
                                    title='目录'
                                    onClick={onOpen}
                                    className='absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-primary-400 opacity-50 transition-opacity hover:bg-default-100 hover:text-primary-600 focus-visible:opacity-100 group-hover:opacity-100'
                                >
                                    <PiListBullets className='text-base' />
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}

            <Drawer isOpen={isOpen} onOpenChange={onOpenChange} placement='right' size='xs'>
                <DrawerContent>
                    {onClose => (
                        <>
                            <DrawerHeader className='px-4 pb-3 pt-5'>
                                <span className='text-base font-semibold leading-none'>目录</span>
                            </DrawerHeader>
                            <DrawerBody className='px-0 pb-8'>
                                <ScrollShadow>
                                    <PdfTocList
                                        bookmarks={bookmarks}
                                        onSelect={pageIndex => {
                                            navigateRef.current?.(pageIndex)
                                            onClose()
                                        }}
                                    />
                                </ScrollShadow>
                            </DrawerBody>
                        </>
                    )}
                </DrawerContent>
            </Drawer>
        </div>
    )
}
