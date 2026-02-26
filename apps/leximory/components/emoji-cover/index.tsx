import { cn } from '@heroui/theme'
import { useRef, useMemo, useEffect } from 'react'
import LoadingIndicatorWrapper from '../ui/loading-indicator-wrapper'
import { useDarkMode } from 'usehooks-ts'

// --- GLOBAL TICKER ---
type DitherTask = (timestamp: number) => void
const subscribers = new Set<DitherTask>()
let globalFrameId: number | null = null

function startGlobalTicker() {
    if (globalFrameId !== null) return
    const tick = (ts: number) => {
        subscribers.forEach(task => task(ts))
        globalFrameId = requestAnimationFrame(tick)
    }
    globalFrameId = requestAnimationFrame(tick)
}

function stopGlobalTicker() {
    if (globalFrameId !== null) {
        cancelAnimationFrame(globalFrameId)
        globalFrameId = null
    }
}

// --- CORE UTILS ---

function hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
    }
    return Math.abs(hash)
}

export function emojiBackground(id: string): { light: string, dark: string } {
    const h = hashString(id)
    const hue = 130 + (h % 36)
    const chroma = 0.008 + (((h >> 8) % 10) / 10) * 0.012
    const lightness = 0.94 + (((h >> 16) % 10) / 10) * 0.04
    const darkLightness = 0.18 + (((h >> 16) % 10) / 10) * 0.06
    return {
        light: `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue})`,
        dark: `oklch(${darkLightness.toFixed(3)} 0 0)`
    }
}

const BAYER_FLAT = new Float32Array([
    0 / 16, 8 / 16, 2 / 16, 10 / 16,
    12 / 16, 4 / 16, 14 / 16, 6 / 16,
    3 / 16, 11 / 16, 1 / 16, 9 / 16,
    15 / 16, 7 / 16, 13 / 16, 5 / 16,
])

function createColorLUT(hue: number, isDarkMode: boolean) {
    if (typeof document === 'undefined') {
        return new Uint8ClampedArray(256 * 4)
    }
    const lut = new Uint8ClampedArray(256 * 4)
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return lut
    for (let i = 0; i < 256; i++) {
        const intensity = i / 255
        let l, chr, h_val, alpha
        if (isDarkMode) {
            l = 0.28 + intensity * 0.15; chr = 0; h_val = 0
            alpha = 0.08 + intensity * 0.25
        } else {
            l = 0.75 + intensity * 0.13; chr = 0.015 + intensity * 0.04
            h_val = hue
            alpha = 0.12 + intensity * 0.5
        }
        ctx.clearRect(0, 0, 256, 1)
        ctx.fillStyle = `oklch(${l.toFixed(3)} ${chr.toFixed(3)} ${h_val} / ${alpha.toFixed(3)})`
        ctx.fillRect(i, 0, 1, 1)
        const pixel = ctx.getImageData(i, 0, 1, 1).data
        const idx = i * 4
        lut[idx] = pixel[0]; lut[idx + 1] = pixel[1]; lut[idx + 2] = pixel[2]; lut[idx + 3] = pixel[3]
    }
    return lut
}

function seededRandom(seed: number) {
    let s = seed
    return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646 }
}

interface GradientSource { cx: number; cy: number; radius: number; strength: number; phaseX: number; phaseY: number; speed: number }

function deriveGradientSources(id: string): GradientSource[] {
    const h = hashString(id); const rng = seededRandom(h)
    const count = 3 + Math.floor(rng() * 3)
    const sources: GradientSource[] = []
    for (let i = 0; i < count; i++) {
        sources.push({
            cx: rng() * 0.8 + 0.1, cy: rng() * 0.8 + 0.1, radius: 0.4 + rng() * 0.5,
            strength: 0.4 + rng() * 0.5, phaseX: rng() * Math.PI * 2, phaseY: rng() * Math.PI * 2,
            speed: 0.12 + rng() * 0.25,
        })
    }
    return sources
}

function BayerDither({ articleId, dynamic, isDarkMode }: { articleId: string; dynamic: boolean; isDarkMode: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const sources = useMemo(() => deriveGradientSources(articleId), [articleId])
    const hue = useMemo(() => 125 + (hashString(articleId) % 45), [articleId])
    const colorLUT = useMemo(() => createColorLUT(hue, isDarkMode), [hue, isDarkMode])

    const stateRef = useRef<{
        startTime: number
        w: number
        h: number
        cachedImgData: ImageData | null
        isVisible: boolean
    }>({
        startTime: 0,
        w: 0,
        h: 0,
        cachedImgData: null,
        isVisible: false
    })

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })
        if (!ctx) return

        const renderFrame = (timestamp: number) => {
            const state = stateRef.current
            if (!state.isVisible || !canvas || !ctx) return
            if (state.startTime === 0) state.startTime = timestamp

            const pixelSize = 4
            // PIXEL FIX: Use floor to ensure square aspect ratio
            const cols = Math.floor(state.w / pixelSize)
            const rows = Math.floor(state.h / pixelSize)

            if (cols <= 0 || rows <= 0) return

            if (canvas.width !== cols || canvas.height !== rows) {
                canvas.width = cols
                canvas.height = rows
                state.cachedImgData = null
            }

            if (!state.cachedImgData) {
                state.cachedImgData = ctx.createImageData(cols, rows)
            }

            const imgData = state.cachedImgData
            const pixels = imgData.data
            pixels.fill(0)

            const elapsed = (timestamp - state.startTime) / 1000

            for (let r = 0; r < rows; r++) {
                const ny = r / rows
                const bayerRowStart = (r % 4) << 2
                for (let c = 0; c < cols; c++) {
                    const nx = c / cols
                    let val = 0
                    for (let i = 0; i < sources.length; i++) {
                        const s = sources[i]
                        const sx = s.cx + (dynamic ? Math.sin(elapsed * s.speed + s.phaseX) * 0.14 : 0)
                        const sy = s.cy + (dynamic ? Math.cos(elapsed * s.speed * 0.8 + s.phaseY) * 0.12 : 0)
                        const dx = nx - sx; const dy = ny - sy
                        const dist = Math.sqrt(dx * dx + dy * dy)
                        val += s.strength * Math.max(0, 1 - dist / s.radius)
                    }
                    if (val > 1) val = 1
                    if (val > BAYER_FLAT[bayerRowStart + (c % 4)] * 0.85) {
                        const lIdx = ((val * 255) | 0) << 2
                        const pIdx = (r * cols + c) << 2
                        pixels[pIdx] = colorLUT[lIdx]; pixels[pIdx + 1] = colorLUT[lIdx + 1]
                        pixels[pIdx + 2] = colorLUT[lIdx + 2]; pixels[pIdx + 3] = colorLUT[lIdx + 3]
                    }
                }
            }
            ctx.putImageData(imgData, 0, 0)
        }

        // ResizeObserver handles sizing (contentRect is valid here)
        const resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (entry) {
                stateRef.current.w = entry.contentRect.width
                stateRef.current.h = entry.contentRect.height
                // Redraw once on resize if not dynamic
                if (!dynamic) requestAnimationFrame(() => renderFrame(0))
            }
        })

        // IntersectionObserver handles visibility/ticker subscription
        const intersectionObserver = new IntersectionObserver((entries) => {
            const isVisible = entries[0].isIntersecting
            stateRef.current.isVisible = isVisible

            if (isVisible && dynamic) {
                subscribers.add(renderFrame)
                startGlobalTicker()
            } else {
                subscribers.delete(renderFrame)
                if (subscribers.size === 0) stopGlobalTicker()
            }
        }, { threshold: 0.01 })

        resizeObserver.observe(canvas)
        intersectionObserver.observe(canvas)

        return () => {
            resizeObserver.disconnect()
            intersectionObserver.disconnect()
            subscribers.delete(renderFrame)
            if (subscribers.size === 0) stopGlobalTicker()
        }
    }, [dynamic, sources, colorLUT])

    return (
        <canvas
            ref={canvasRef}
            className='pointer-events-none absolute inset-0 h-full w-full'
            style={{ imageRendering: 'pixelated', objectFit: 'fill' }}
            aria-hidden='true'
        />
    )
}

export function EmojiCover({ emoji, articleId, className = '', isLink = false }: { emoji: string, articleId: string, className?: string, isLink?: boolean }) {
    const bg = useMemo(() => emojiBackground(articleId), [articleId])
    const { isDarkMode } = useDarkMode()

    return (
        <div
            className={cn('relative flex items-center justify-center rounded-4xl overflow-clip', className)}
            style={{ containerType: 'size', backgroundColor: isDarkMode ? bg.dark : bg.light }}
        >
            <BayerDither articleId={articleId} dynamic={true} isDarkMode={isDarkMode} />
            <div className='w-full h-full flex items-center justify-center z-1'>
                <span className='select-none leading-none' style={{ fontSize: 'min(35cqi, 35cqb)' }}>
                    {isLink ? (
                        <LoadingIndicatorWrapper variant='spinner' classNames={{ wrapper: 'w-[min(35cqi,35cqb)] h-[min(35cqi,35cqb)]' }}>
                            {emoji}
                        </LoadingIndicatorWrapper>
                    ) : emoji}
                </span>
            </div>
        </div>
    )
}
