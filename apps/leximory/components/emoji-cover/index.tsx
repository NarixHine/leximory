import { cn } from '@heroui/theme'
import { useRef, useMemo, useEffect } from 'react'
import LoadingIndicatorWrapper from '../ui/loading-indicator-wrapper'
import { useDarkMode } from 'usehooks-ts'

/** Stable hash (djb2 variant). Bitwise OR with 0 converts to 32-bit int to prevent overflow. */
function hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash + char) | 0
    }
    return Math.abs(hash)
}

/**
 * OKLCH background tuned to Morandi green range.
 */
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

// ─── Bayer 4x4 dither visual hash ──────────────────────────

const BAYER_4x4 = [
    [0 / 16, 8 / 16, 2 / 16, 10 / 16],
    [12 / 16, 4 / 16, 14 / 16, 6 / 16],
    [3 / 16, 11 / 16, 1 / 16, 9 / 16],
    [15 / 16, 7 / 16, 13 / 16, 5 / 16],
]

function seededRandom(seed: number) {
    let s = seed
    return () => {
        s = (s * 16807 + 0) % 2147483647
        return (s - 1) / 2147483646
    }
}

interface GradientSource {
    cx: number
    cy: number
    radius: number
    strength: number
    phaseX: number
    phaseY: number
    speed: number
}

function deriveGradientSources(id: string): GradientSource[] {
    const h = hashString(id)
    const rng = seededRandom(h)
    const count = 3 + Math.floor(rng() * 3) // Increased slightly for better density (3..6)
    const sources: GradientSource[] = []
    for (let i = 0; i < count; i++) {
        sources.push({
            cx: rng() * 0.8 + 0.1,
            cy: rng() * 0.8 + 0.1,
            radius: 0.4 + rng() * 0.5,
            strength: 0.4 + rng() * 0.5,
            phaseX: rng() * Math.PI * 2,
            phaseY: rng() * Math.PI * 2,
            speed: 0.12 + rng() * 0.25,
        })
    }
    return sources
}

function deriveHue(id: string): number {
    const h = hashString(id)
    return 125 + (h % 45) 
}

function BayerDither({
    articleId,
    dynamic,
    isDarkMode,
}: {
    articleId: string
    dynamic: boolean
    isDarkMode: boolean
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animRef = useRef<number>(0)
    const dynamicRef = useRef(dynamic)
    dynamicRef.current = dynamic

    const sources = useMemo(() => deriveGradientSources(articleId), [articleId])
    const hue = useMemo(() => deriveHue(articleId), [articleId])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        let cancelled = false
        let startTime: number | null = null

        function render(timestamp: number) {
            if (cancelled || !canvas) return
            const rect = canvas.getBoundingClientRect()
            const w = rect.width
            const h = rect.height
            if (w === 0 || h === 0) {
                if (dynamicRef.current) animRef.current = requestAnimationFrame(render)
                return
            }

            // High Resolution Fix: 
            // Instead of increasing pixelSize with container size, we use a fixed small size.
            // This ensures the "resolution" (number of particles) grows as the area grows.
            const pixelSize = 4 
            const cols = Math.ceil(w / pixelSize)
            const rows = Math.ceil(h / pixelSize)

            if (canvas.width !== cols || canvas.height !== rows) {
                canvas.width = cols
                canvas.height = rows
            }

            const ctx = canvas.getContext('2d', { alpha: true })
            if (!ctx) return
            ctx.clearRect(0, 0, cols, rows)

            let elapsed = 0
            if (dynamicRef.current && timestamp > 0) {
                if (startTime === null) startTime = timestamp
                elapsed = (timestamp - startTime) / 1000
            }

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const nx = c / cols
                    const ny = r / rows

                    let value = 0
                    for (const src of sources) {
                        let sx = src.cx
                        let sy = src.cy
                        if (dynamicRef.current && elapsed > 0) {
                            sx += Math.sin(elapsed * src.speed + src.phaseX) * 0.14
                            sy += Math.cos(elapsed * src.speed * 0.8 + src.phaseY) * 0.12
                        }
                        const dx = nx - sx
                        const dy = ny - sy
                        const dist = Math.sqrt(dx * dx + dy * dy)
                        value += src.strength * Math.max(0, 1 - dist / src.radius)
                    }
                    value = Math.min(1, value)

                    const bx = c % 4
                    const by = r % 4
                    const threshold = BAYER_4x4[by][bx]

                    if (value > threshold * 0.85) {
                        const intensity = Math.min(1, value)
                        
                        let l, chr, h_val, alpha;

                        if (isDarkMode) {
                            // Dark Mode Adaptation: Neutral "Glow"
                            // Uses zero chroma to match the neutral grey background
                            l = 0.28 + intensity * 0.15   // Subtly lighter than background
                            chr = 0                      // Neutral greyscale
                            h_val = 0                    // Hue irrelevant when chroma is 0
                            alpha = 0.08 + intensity * 0.25
                        } else {
                            // Light Mode: Morandi Green
                            l = 0.75 + intensity * 0.13
                            chr = 0.015 + intensity * 0.04
                            h_val = hue
                            alpha = 0.12 + intensity * 0.5
                        }

                        ctx.fillStyle = `oklch(${l.toFixed(3)} ${chr.toFixed(3)} ${h_val} / ${alpha.toFixed(3)})`
                        ctx.fillRect(c, r, 1, 1)
                    }
                }
            }

            if (dynamicRef.current && !cancelled) {
                animRef.current = requestAnimationFrame(render)
            }
        }

        if (dynamic) {
            startTime = null
            animRef.current = requestAnimationFrame(render)
        } else {
            render(0)
        }

        const resizeObserver = new ResizeObserver(() => {
            if (!dynamicRef.current) render(0)
        })
        resizeObserver.observe(canvas)

        return () => {
            cancelled = true
            cancelAnimationFrame(animRef.current)
            resizeObserver.disconnect()
        }
    }, [dynamic, sources, hue, isDarkMode]) // Added isDarkMode to dependency array

    return (
        <canvas
            ref={canvasRef}
            className='pointer-events-none absolute inset-0 h-full w-full'
            style={{ imageRendering: 'pixelated' }}
            aria-hidden='true'
        />
    )
}

export function EmojiCover({ emoji, articleId, className = '', isLink = false }: { emoji: string, articleId: string, className?: string, isLink?: boolean }) {
    const bg = emojiBackground(articleId)
    const { isDarkMode } = useDarkMode()
    
    const emojiSpan = (
        <span className='select-none leading-none' style={{ fontSize: 'min(35cqi, 35cqb)' }}>
            {emoji}
        </span>
    )
    
    const emojiContent = isLink
        ? <LoadingIndicatorWrapper variant='spinner' classNames={{ wrapper: 'w-[min(35cqi,35cqb)] h-[min(35cqi,35cqb)]' }}>{emojiSpan}</LoadingIndicatorWrapper>
        : emojiSpan
        
    return (
        <div
            className={cn('relative flex items-center justify-center rounded-4xl overflow-clip', className)}
            style={{
                 containerType: 'size',
                 backgroundColor: isDarkMode ? bg.dark : bg.light,
            }}
        >
            <BayerDither articleId={articleId} dynamic={true} isDarkMode={isDarkMode} />
            <div className='w-full h-full flex items-center justify-center z-1'>
                {emojiContent}
            </div>
        </div>
    )
}
