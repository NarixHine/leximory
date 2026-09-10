'use client'

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { useEffect, useRef, useState } from 'react'
import { CircularProgress } from '@heroui/react'

interface PdfReaderProps {
    url: string
    location: string | number
    onLocationChange: (page: string) => void
    onSelection?: (selection: Selection, rect: DOMRect, page: number) => void
    highlights?: string[]
    dark?: boolean
    title?: string
    actions?: React.ReactNode
}

const PAGE_PADDING = 16

function findTextRange(root: Node, query: string): Range | null {
    const target = query
        .replace(/\\([!-/:-@[-`{-~])/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/\s+/g, ' ')
        .trim()
    if (!target) return null
    const document = root.ownerDocument
    if (!document) return null
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    let current = walker.nextNode()
    while (current) {
        nodes.push(current as Text)
        current = walker.nextNode()
    }

    let normalized = ''
    const positions: { node: Text; offset: number }[] = []
    let pendingSpace = false
    for (const node of nodes) {
        for (let offset = 0; offset < node.data.length; offset++) {
            if (/\s/.test(node.data[offset])) {
                if (normalized) pendingSpace = true
                continue
            }
            if (pendingSpace) {
                normalized += ' '
                positions.push({ node, offset })
                pendingSpace = false
            }
            normalized += node.data[offset]
            positions.push({ node, offset })
        }
    }

    const start = normalized.indexOf(target)
    if (start < 0) return null
    const startPosition = positions[start]
    const endPosition = positions[start + target.length - 1]
    if (!startPosition || !endPosition) return null
    const range = document.createRange()
    range.setStart(startPosition.node, startPosition.offset)
    range.setEnd(endPosition.node, endPosition.offset + 1)
    return range
}

function wrapRange(range: Range, dark: boolean) {
    const root = range.commonAncestorContainer
    const document = root.ownerDocument
    if (!document) return
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    if (root.nodeType === Node.TEXT_NODE) nodes.push(root as Text)
    let current = walker.nextNode()
    while (current) {
        nodes.push(current as Text)
        current = walker.nextNode()
    }

    for (const node of nodes) {
        if (node.parentElement?.closest('[data-pdf-highlight]')) continue
        if (!range.intersectsNode(node)) continue
        const start = node === range.startContainer ? range.startOffset : 0
        const end = node === range.endContainer ? range.endOffset : node.length
        if (end <= start) continue
        const selected = start ? node.splitText(start) : node
        if (end - start < selected.length) selected.splitText(end - start)
        const mark = document.createElement('span')
        mark.dataset.pdfHighlight = 'true'
        mark.style.setProperty(
            'background-image',
            `linear-gradient(to bottom, transparent 45%, ${dark ? 'rgb(123 191 99 / 0.35)' : 'rgb(183 224 143 / 0.5)'} 45%, ${dark ? 'rgb(123 191 99 / 0.35)' : 'rgb(183 224 143 / 0.5)'} 82%, transparent 82%)`,
            'important',
        )
        mark.style.setProperty('color', 'inherit', 'important')
        selected.parentNode?.insertBefore(mark, selected)
        mark.appendChild(selected)
    }
}

function renderPage(
    page: PDFPageProxy,
    canvas: HTMLCanvasElement,
    textLayer: HTMLDivElement,
    scale: number,
    onWidth: (width: number) => void,
) {
    const viewport = page.getViewport({ scale })
    onWidth(viewport.width)
    const outputScale = window.devicePixelRatio || 1
    canvas.width = Math.ceil(viewport.width * outputScale)
    canvas.height = Math.ceil(viewport.height * outputScale)
    canvas.style.width = `${viewport.width}px`
    canvas.style.height = `${viewport.height}px`
    textLayer.replaceChildren()
    textLayer.style.width = `${viewport.width}px`
    textLayer.style.height = `${viewport.height}px`
    textLayer.style.setProperty('--total-scale-factor', `${scale}`)
    const context = canvas.getContext('2d')
    if (!context) return Promise.resolve()
    context.setTransform(outputScale, 0, 0, outputScale, 0, 0)
    const task = page.render({ canvas, canvasContext: context, viewport })
    return Promise.all([
        task.promise,
        page.getTextContent().then(async textContent => {
            const { TextLayer } = await import('pdfjs-dist')
            const layer = new TextLayer({ textContentSource: textContent, container: textLayer, viewport })
            await layer.render()
        }),
    ]).then(() => undefined)
}

export default function PdfReader({
    url,
    location,
    onLocationChange,
    onSelection,
    highlights = [],
    dark = false,
    title = '',
    actions,
}: PdfReaderProps) {
    const viewerRef = useRef<HTMLDivElement>(null)
    const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
    const [pageCount, setPageCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [pageWidth, setPageWidth] = useState<number | null>(null)
    const onLocationChangeRef = useRef(onLocationChange)
    onLocationChangeRef.current = onLocationChange

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)
        setPdf(null)
        import('pdfjs-dist')
            .then(pdfjs => {
                pdfjs.GlobalWorkerOptions.workerSrc = new URL(
                    'pdfjs-dist/build/pdf.worker.min.mjs',
                    import.meta.url,
                ).toString()
                return pdfjs.getDocument({ url }).promise
            })
            .then(document => {
                if (cancelled) {
                    document.destroy()
                    return
                }
                setPdf(document)
                setPageCount(document.numPages)
                setLoading(false)
            })
            .catch(reason => {
                if (cancelled) return
                setError(reason instanceof Error ? reason.message : '无法加载 PDF')
                setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [url])

    useEffect(() => {
        if (!pdf || !viewerRef.current) return
        let cancelled = false
        const viewer = viewerRef.current
        viewer.replaceChildren()
        const observer = new IntersectionObserver(
            entries => {
                const visible = entries
                    .filter(entry => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
                const page = (visible?.target as HTMLElement | undefined)?.dataset.page
                if (page) onLocationChangeRef.current(page)
            },
            { root: viewer, threshold: [0.25, 0.5, 0.75] },
        )
        const render = async () => {
            const availableWidth = Math.max(viewer.clientWidth - PAGE_PADDING * 2, 320)
            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                if (cancelled) return
                const page = await pdf.getPage(pageNumber)
                const baseViewport = page.getViewport({ scale: 1 })
                const scale = Math.max(0.6, Math.min(2, availableWidth / baseViewport.width))
                const wrapper = document.createElement('section')
                wrapper.className = 'relative mx-auto mb-6 w-fit rounded-sm bg-white shadow-sm'
                wrapper.dataset.page = String(pageNumber)
                const canvas = document.createElement('canvas')
                const textLayer = document.createElement('div')
                textLayer.className = 'textLayer'
                textLayer.style.position = 'absolute'
                textLayer.style.inset = '0'
                textLayer.style.overflow = 'hidden'
                wrapper.append(canvas, textLayer)
                viewer.append(wrapper)
                observer.observe(wrapper)
                await renderPage(page, canvas, textLayer, scale, width => {
                    setPageWidth(previous => (previous === width ? previous : width))
                })
                for (const highlight of highlights) {
                    const range = findTextRange(textLayer, highlight)
                    if (range) wrapRange(range, dark)
                }
                if (Number(location) === pageNumber) wrapper.scrollIntoView({ block: 'start' })
            }
            if (!cancelled) setLoading(false)
        }
        void render()
        return () => {
            cancelled = true
            observer.disconnect()
        }
    }, [pdf, highlights, dark])

    useEffect(() => {
        const viewer = viewerRef.current
        if (!viewer) return
        const handleSelection = () => {
            const selection = viewer.ownerDocument.getSelection()
            if (!selection?.toString() || !selection.rangeCount || !onSelection) return
            const range = selection.getRangeAt(0)
            const page = Number((range.commonAncestorContainer.parentElement?.closest('[data-page]') as HTMLElement | null)?.dataset.page ?? 1)
            onSelection(selection, range.getBoundingClientRect(), page)
        }
        viewer.addEventListener('mouseup', handleSelection)
        return () => viewer.removeEventListener('mouseup', handleSelection)
    }, [onSelection])

    return (
        <div className='group relative flex h-full min-h-0 flex-col'>
            <div className='flex h-15 shrink-0 items-center px-1'>
                <div className='flex-1' />
                <span className='truncate px-2 text-center text-sm text-primary-400'>{title}</span>
                <div className='flex flex-1 justify-end gap-0.5 px-2'>{actions}</div>
            </div>
            <div ref={viewerRef} className='min-h-0 flex-1 overflow-auto bg-background p-6' />
            {loading && (
                <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
                    <CircularProgress color='primary' size='lg' />
                </div>
            )}
            {error && <div className='absolute inset-0 flex items-center justify-center p-6 text-danger'>{error}</div>}
            {pageCount > 0 && (
                <div
                    className='mx-auto shrink-0 border-x border-t border-default-200/60 py-3 text-center text-sm text-primary-400'
                    style={pageWidth ? { width: `${pageWidth}px` } : undefined}
                >
                    {Number(location) || 1} / {pageCount}
                </div>
            )}
        </div>
    )
}
