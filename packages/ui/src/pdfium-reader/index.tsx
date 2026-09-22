'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
    PdfDocumentObject,
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
    type SelectionDocumentState,
    useSelectionCapability,
} from '@embedpdf/plugin-selection/react'
import {
    Viewport,
    ViewportPluginPackage,
    useViewportElement,
} from '@embedpdf/plugin-viewport/react'
import { ZoomMode, ZoomPluginPackage, useZoom } from '@embedpdf/plugin-zoom/react'
import { Button, CircularProgress, useDisclosure } from '@heroui/react'
import { cn } from '@heroui/theme'
import { PiArrowClockwise, PiWarningCircle } from 'react-icons/pi'
import { TocDrawer, TocTrigger, hrefBase, subtreeContains, type TocItem } from '../toc'

interface PdfiumReaderProps {
    url: string
    title?: string
    actions?: React.ReactNode
    dark?: boolean
    /** 1-based page to restore to once the document first lays out. */
    initialPage?: number
    /** Maximum surrounding characters to include on each side of a selection. */
    selectionContextRadius?: number
    /** Sentence-ending characters used when trimming PDF annotation context. */
    sentenceEndMarkers?: string
    onLocationChange?: (page: string) => void
    onSelection?: (
        text: string,
        page: number,
        rect: { left: number; top: number; width: number; height: number },
        context?: string,
    ) => void
    onSelectionClear?: () => void
    highlights?: string[]
    /** Element the ToC drawer portals into, so it survives the Fullscreen API. */
    portalContainer?: Element
    /** Optional control rendered to the left of the footer page counter. */
    footerLeading?: React.ReactNode
}

function isPdfContextBoundary(text: string, index: number, sentenceEndMarkers: string) {
    const character = text[index]
    if (sentenceEndMarkers.includes(character)) return true
    return character === '\n' && text[index + 1] === '\n'
}

/** Adds nearby PDF text while marking the exact selection for the annotation prompt. */
function findPdfSelectionBounds(
    text: string,
    selectedText: string,
    expectedStart: number,
    expectedEnd: number,
) {
    const candidates: Array<{ start: number; end: number }> = []
    let index = text.indexOf(selectedText)
    while (index !== -1) {
        candidates.push({ start: index, end: index + selectedText.length })
        index = text.indexOf(selectedText, index + 1)
    }

    if (candidates.length > 0) {
        return candidates.reduce((closest, candidate) =>
            Math.abs(candidate.start - expectedStart) < Math.abs(closest.start - expectedStart)
                ? candidate
                : closest,
        )
    }

    const words = selectedText.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) return null
    const pattern = words
        .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('\\s+')
    const expression = new RegExp(pattern, 'g')
    while (true) {
        const match = expression.exec(text)
        if (!match || match.index === undefined) break
        candidates.push({ start: match.index, end: match.index + match[0].length })
    }

    return candidates.reduce<{ start: number; end: number } | null>(
        (closest, candidate) =>
            !closest ||
            Math.abs(candidate.start - expectedStart) < Math.abs(closest.start - expectedStart)
                ? candidate
                : closest,
        null,
    )
}

function bracketPdfSelection(
    text: string,
    selectedText: string,
    start: number,
    end: number,
    contextRadius: number,
    sentenceEndMarkers: string,
) {
    const expectedStart = Math.max(0, Math.min(start, text.length))
    const expectedEnd = Math.max(expectedStart, Math.min(end + 1, text.length))
    const bounds = findPdfSelectionBounds(text, selectedText, expectedStart, expectedEnd)
    const selectionStart = bounds?.start ?? expectedStart
    const selectionEnd = bounds?.end ?? expectedEnd
    const selected = text.slice(selectionStart, selectionEnd)
    if (!selected.trim()) return null

    const leftLimit = Math.max(0, selectionStart - contextRadius)
    let contextStart = selectionStart
    for (let index = selectionStart - 1; index >= leftLimit; index--) {
        contextStart = index
        if (isPdfContextBoundary(text, index, sentenceEndMarkers)) break
    }

    const rightLimit = Math.min(text.length, selectionEnd + contextRadius)
    let contextEnd = selectionEnd
    for (let index = selectionEnd; index < rightLimit; index++) {
        contextEnd = index + 1
        if (isPdfContextBoundary(text, index, sentenceEndMarkers)) break
    }

    const before = text.slice(contextStart, selectionStart).trim()
    const after = text.slice(selectionEnd, contextEnd).trim()
    return `${before ? `${before} ` : ''}<must>${selected}</must>${after ? ` ${after}` : ''}`
}

async function getPdfSelectionContext({
    engine,
    document,
    state,
    pageIndex,
    selectedText,
    contextRadius,
    sentenceEndMarkers,
}: {
    engine: PdfEngine
    document: PdfDocumentObject | undefined
    state: SelectionDocumentState
    pageIndex: number
    selectedText: string
    contextRadius: number
    sentenceEndMarkers: string
}) {
    if (!document) return null

    const slice = state.slices[pageIndex]
    const geometry = state.geometry[pageIndex]
    if (!slice || !geometry) return null

    const lastRun = geometry.runs[geometry.runs.length - 1]
    const totalCharacters = lastRun ? lastRun.charStart + lastRun.glyphs.length : 0
    if (totalCharacters === 0) return null

    const contextStart = Math.max(0, slice.start - contextRadius)
    const contextEnd = Math.min(
        totalCharacters,
        slice.start + slice.count + contextRadius,
    )
    if (contextEnd <= contextStart) return null

    try {
        const [text] = await engine
            .getTextSlices(document, [
                {
                    pageIndex,
                    charIndex: contextStart,
                    charCount: contextEnd - contextStart,
                },
            ])
            .toPromise()
        return bracketPdfSelection(
            text,
            selectedText,
            slice.start - contextStart,
            slice.start + slice.count - 1 - contextStart,
            contextRadius,
            sentenceEndMarkers,
        )
    } catch {
        return null
    }
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
    engine,
    contextRadius,
    sentenceEndMarkers,
    onSelection,
    onClear,
}: {
    documentId: string
    engine: PdfEngine
    contextRadius: number
    sentenceEndMarkers: string
    onSelection?: PdfiumReaderProps['onSelection']
    onClear?: () => void
}) {
    const { provides } = useSelectionCapability()
    const documentState = useDocumentState(documentId)
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
            const rawText = texts.join('\n')
            const rect = {
                left: pageRect.left + formatted.rect.origin.x * scale,
                top: pageRect.top + formatted.rect.origin.y * scale,
                width: formatted.rect.size.width * scale,
                height: formatted.rect.size.height * scale,
            }
            void getPdfSelectionContext({
                engine,
                document: documentState?.document ?? undefined,
                state: scope.getState(),
                pageIndex: formatted.pageIndex,
                selectedText: rawText,
                contextRadius,
                sentenceEndMarkers,
            }).then(context => {
                onSelection(
                    rawText,
                    formatted.pageIndex + 1,
                    rect,
                    context ?? `<must>${rawText}</must>`,
                )
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
    }, [
        contextRadius,
        documentId,
        documentState?.document,
        engine,
        sentenceEndMarkers,
        onSelection,
        onClear,
        provides,
    ])

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
/** How long reporting pauses after a gesture-less reflow trigger. */
const REFLOW_SETTLE_MS = 1000
/** How often the settle window re-checks for reflow resets. */
const REFLOW_REASSERT_MS = 150
/** Hard cap so a document that never lays out cannot block page reporting forever. */
const PAN_RESTORE_MAX_MS = 10000
/** How often the restore hold re-checks for a silent layout reset. */
const PAN_RESTORE_POLL_MS = 250

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
 * Timing hazards this guards against:
 *
 * 1. The restored page arrives through a storage-backed atom, which hydrates a
 *    tick after mount, so the target is re-read on every render and restored
 *    again when it changes instead of locking in the first (possibly empty)
 *    value.
 * 2. The scroller's geometry needs the final fit-width scale, which is
 *    recalculated after the first layout and can scroll back to the top. The
 *    saved page is therefore re-asserted on every layout change (and polled)
 *    until the reader is actually used, so a late recalc cannot strand it.
 * 3. Reflows that happen without any user gesture — fit-width recalculations
 *    after a viewport resize, the browser reclaiming scroll position when a
 *    fullscreen element enters or leaves the top layer, and app switches that
 *    tear down and recreate the fullscreen space — can momentarily land the
 *    scroller on page 1. During a settle window after any such trigger,
 *    reporting pauses and the last confirmed page is re-asserted on deviation,
 *    so a transient value can neither reach the host nor overwrite the user's
 *    real position. Reporting also stays silent while the document is hidden,
 *    because nothing user-driven can happen then.
 *
 * The hold releases on the first real interaction (or a hard cap) so it never
 * fights the reader, and reporting stays silent until the restore has settled
 * so the placeholder page count on mount cannot overwrite the stored position.
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
    const restoredRef = useRef(false)
    const [released, setReleased] = useState(false)
    const [settling, setSettling] = useState(false)
    const settleTimerRef = useRef(0)
    const anchorRef = useRef(1)

    if (!released && initialPage !== undefined) {
        targetRef.current = Math.round(initialPage)
    }

    /**
     * Opens a settle window after a gesture-less reflow trigger. While it is
     * open, page reporting pauses and the anchor page is re-asserted on
     * deviation, so reflow transients cannot overwrite the reading position.
     */
    const beginSettle = useCallback(() => {
        window.clearTimeout(settleTimerRef.current)
        settleTimerRef.current = window.setTimeout(() => setSettling(false), REFLOW_SETTLE_MS)
        setSettling(true)
    }, [])

    useEffect(() => () => window.clearTimeout(settleTimerRef.current), [])

    // Gesture-less reflow triggers: window resizes, fullscreen transitions,
    // and app/tab switches (focus + visibility). macOS reclaims the scroll
    // position of a fullscreen space when another app takes over, so switching
    // back must open a window even though nothing was resized.
    useEffect(() => {
        const onVisibility = () => {
            if (!document.hidden) beginSettle()
        }
        window.addEventListener('resize', beginSettle)
        window.addEventListener('focus', beginSettle)
        document.addEventListener('visibilitychange', onVisibility)
        document.addEventListener('fullscreenchange', beginSettle)
        document.addEventListener('webkitfullscreenchange', beginSettle)
        return () => {
            window.removeEventListener('resize', beginSettle)
            window.removeEventListener('focus', beginSettle)
            document.removeEventListener('visibilitychange', onVisibility)
            document.removeEventListener('fullscreenchange', beginSettle)
            document.removeEventListener('webkitfullscreenchange', beginSettle)
        }
    }, [beginSettle])

    // The restore hold ends on the first real interaction, or after a hard cap
    // for a reader that is opened and never touched.
    useEffect(() => {
        if (released) return
        const release = () => setReleased(true)
        document.addEventListener('pointerdown', release)
        document.addEventListener('wheel', release, { passive: true })
        document.addEventListener('touchstart', release, { passive: true })
        document.addEventListener('keydown', release)
        const cap = window.setTimeout(release, PAN_RESTORE_MAX_MS)
        return () => {
            document.removeEventListener('pointerdown', release)
            document.removeEventListener('wheel', release)
            document.removeEventListener('touchstart', release)
            document.removeEventListener('keydown', release)
            window.clearTimeout(cap)
        }
    }, [released])

    // Keep the saved page pinned across layout recalculations until the reader
    // is actually used. Re-applying only on deviation avoids fighting a scroll,
    // and the periodic check catches silent resets that emit no layout event.
    // Depending on `initialPage` also lets a late storage hydration still land.
    // Once the reader has been used, the saved page is never re-asserted again:
    // the host keeps writing the current location back into `initialPage`, and
    // re-applying on those updates would repeatedly snap the reader to the
    // restore target instead of letting the scroll stand.
    useEffect(() => {
        if (!scroll) return
        const scope = scroll.forDocument(documentId)

        const apply = () => {
            const target = targetRef.current
            if (target <= 1) {
                restoredRef.current = true
                return
            }
            if (scope.getLayout().virtualItems.length === 0) return
            if (scope.getCurrentPage() !== target) {
                scope.scrollToPage({ pageNumber: target, behavior: 'instant' })
            }
            restoredRef.current = true
        }

        if (released && restoredRef.current) return

        apply()
        const timer = window.setTimeout(apply, 0)
        if (released) {
            return () => window.clearTimeout(timer)
        }

        const interval = window.setInterval(apply, PAN_RESTORE_POLL_MS)
        const layoutReady = scroll.onLayoutReady(event => {
            if (event.documentId === documentId) apply()
        })
        const layoutChange = scroll.onLayoutChange(event => {
            if (event.documentId === documentId) apply()
        })

        return () => {
            window.clearTimeout(timer)
            window.clearInterval(interval)
            layoutReady()
            layoutChange()
        }
    }, [scroll, documentId, released, initialPage])

    // While a settle window is open, pull the scroller back to the last page
    // the user actually confirmed. Every reset emits commit updates, each of
    // which re-checks the deviation; the interval also catches resets that
    // arrive without one (e.g. a clamped scrollTop after a top-layer change).
    useEffect(() => {
        if (!settling || !scroll) return
        const scope = scroll.forDocument(documentId)
        const reassert = () => {
            const anchor = anchorRef.current
            if (anchor <= 1) return
            if (state.totalPages <= 1) return
            if (scope.getLayout().virtualItems.length === 0) return
            if (scope.getCurrentPage() !== anchor) {
                scope.scrollToPage({ pageNumber: anchor, behavior: 'instant' })
            }
        }
        reassert()
        const frame = requestAnimationFrame(reassert)
        const interval = window.setInterval(reassert, REFLOW_REASSERT_MS)
        return () => {
            cancelAnimationFrame(frame)
            window.clearInterval(interval)
        }
    }, [settling, scroll, documentId, state.currentPage, state.totalPages])

    // Layout recalculations (initial layout, rotation, spread, strategy
    // changes) reflow every page without a gesture, so they open their own
    // settle window. Transient page-one values are thereby replaced with a
    // re-assertion of the reader's actual position.
    useEffect(() => {
        if (!scroll) return
        const layoutChange = scroll.onLayoutChange(event => {
            if (event.documentId !== documentId) return
            beginSettle()
        })
        return () => layoutChange()
    }, [scroll, documentId, beginSettle])

    useEffect(() => {
        if (settling) return
        if (document.hidden) return
        if (state.totalPages <= 1) return
        // While the restore hold is active, never persist a page below the
        // saved one: a lower value is a transient from layout recalculation.
        if (!released && targetRef.current > 1 && state.currentPage < targetRef.current) return
        anchorRef.current = state.currentPage
        onPageChange(state.currentPage, state.totalPages)
    }, [released, settling, state.currentPage, state.totalPages, onPageChange])

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

/**
 * Maps the engine's bookmark tree onto the shared ToC shape.
 *
 * `href` encodes the target page (`page:<index>`) so the shared entry and
 * progress logic work unchanged; bookmarks without a target get an inert href
 * and are excluded from the page lookup.
 */
function buildToc(bookmarks: PdfBookmarkObject[]): {
    items: TocItem[]
    pages: Map<string, number>
} {
    const pages = new Map<string, number>()
    const convert = (list: PdfBookmarkObject[], path: string): TocItem[] =>
        list.map((bookmark, index) => {
            const id = `${path}-${index}`
            const pageIndex = bookmarkPageIndex(bookmark)
            const href = pageIndex !== null ? `page:${pageIndex}` : `section:${id}`
            if (pageIndex !== null) pages.set(href, pageIndex)
            const children = bookmark.children ?? []
            return {
                id,
                href,
                label: bookmark.title.trim() || '未命名章节',
                subitems: children.length ? convert(children, id) : undefined,
            }
        })
    return { items: convert(bookmarks, 'toc'), pages }
}

/** The href of the deepest outline entry at or before the current page. */
function findCurrentTocHref(
    items: TocItem[],
    pages: Map<string, number>,
    pageIndex: number,
): string {
    let bestHref = ''
    let bestPage = -1
    const walk = (list: TocItem[]) => {
        for (const item of list) {
            const target = pages.get(item.href)
            if (target !== undefined && target <= pageIndex && target >= bestPage) {
                bestPage = target
                bestHref = item.href
            }
            if (item.subitems) walk(item.subitems)
        }
    }
    walk(items)
    return bestHref
}

/**
 * Reads the document outline from the engine and exposes a jump-to-page handle.
 *
 * The fetch runs once the document object exists and is cached in the parent so
 * the reader's ToC affordance only appears when there is an outline to show.
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
    selectionContextRadius = 500,
    sentenceEndMarkers = '.!?…',
    onLocationChange,
    highlights = [],
    portalContainer,
    footerLeading,
}: PdfiumReaderProps) {
    const { engine, isLoading, error } = usePdfiumEngine()
    const containerRef = useRef<HTMLDivElement>(null)
    const [pageWidth, setPageWidth] = useState<number | null>(null)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(0)
    const [buffer, setBuffer] = useState<ArrayBuffer | null>(null)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [attempt, setAttempt] = useState(0)
    const [tocItems, setTocItems] = useState<TocItem[]>([])
    const tocPagesRef = useRef<Map<string, number>>(new Map())
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
    const navigateRef = useRef<((pageIndex: number) => void) | null>(null)
    const { isOpen, onOpen, onOpenChange } = useDisclosure()

    // Fetching the file ourselves gives precise, user-facing errors (HTTP
    // status, network failure, wrong format) that the engine abstracts away.
    useEffect(() => {
        let cancelled = false
        setBuffer(null)
        setFetchError(null)
        setTocItems([])
        tocPagesRef.current = new Map()
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

    const handleBookmarks = useMemo(
        () => (bookmarks: PdfBookmarkObject[]) => {
            const { items, pages } = buildToc(bookmarks)
            tocPagesRef.current = pages
            setTocItems(items)
        },
        [],
    )

    const toggleExpand = useCallback((id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    const currentTocHref = useMemo(
        () => findCurrentTocHref(tocItems, tocPagesRef.current, page - 1),
        [tocItems, page],
    )

    // Auto-expand ToC parents of the active chapter, mirroring the EPUB reader.
    useEffect(() => {
        if (!tocItems.length || !currentTocHref) return
        const base = hrefBase(currentTocHref)
        setExpandedIds(prev => {
            const next = new Set(prev)
            tocItems.forEach(topItem => {
                if (subtreeContains(topItem, base)) next.add(topItem.id)
            })
            return next
        })
    }, [currentTocHref, tocItems])

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
                                                        engine={engine}
                                                        contextRadius={selectionContextRadius}
                                                        sentenceEndMarkers={sentenceEndMarkers}
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
                                                        onBookmarks={handleBookmarks}
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
                                                        style={{ overflowX: 'hidden' }}
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
                            className='mx-auto grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-1 border-x border-t border-default-200/60 py-3 text-center text-sm text-primary-400'
                            style={pageWidth ? { width: `${pageWidth}px` } : undefined}
                        >
                            <div className='flex items-center justify-end'>{footerLeading}</div>
                            <span>
                                {page} / {totalPages}
                            </span>
                            <div className='flex items-center justify-start'>
                                {tocItems.length > 0 && <TocTrigger onPress={onOpen} />}
                            </div>
                        </div>
                    )}
                </>
            )}

            <TocDrawer
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                title='目录'
                items={tocItems}
                currentHref={currentTocHref}
                currentPage={page}
                totalPages={totalPages}
                onSelect={href => {
                    const pageIndex = tocPagesRef.current.get(href)
                    if (pageIndex !== undefined) navigateRef.current?.(pageIndex)
                }}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
                portalContainer={portalContainer}
            />
        </div>
    )
}
