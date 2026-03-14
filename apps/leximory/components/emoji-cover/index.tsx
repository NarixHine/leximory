'use client'

import { cn } from '@heroui/theme'
import React, { useRef, useMemo, useEffect } from 'react'
import LoadingIndicatorWrapper from '../ui/loading-indicator-wrapper'
import { useDarkMode } from 'usehooks-ts'

// --- GLOBAL TICKER ---
type Task = (timestamp: number) => void
const subscribers = new Set<Task>()
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

function subscribe(task: Task) {
    subscribers.add(task)
    startGlobalTicker()
    return () => {
        subscribers.delete(task)
        if (subscribers.size === 0) stopGlobalTicker()
    }
}

// --- OKLCH → sRGB (for shader uniforms) ---

function oklchToSrgb(L: number, C: number, H: number): [number, number, number] {
    const hRad = (H * Math.PI) / 180
    const a = C * Math.cos(hRad)
    const b = C * Math.sin(hRad)
    const lp = L + 0.3963377774 * a + 0.2158037573 * b
    const mp = L - 0.1055613458 * a - 0.0638541728 * b
    const sp = L - 0.0894841775 * a - 1.2914855480 * b
    const l = lp ** 3, m = mp ** 3, s = sp ** 3
    const gamma = (x: number) => x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
    return [
        Math.min(1, Math.max(0, gamma(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s))),
        Math.min(1, Math.max(0, gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s))),
        Math.min(1, Math.max(0, gamma(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)))
    ]
}

// --- CORE UTILS ---

function hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
    }
    return Math.abs(hash)
}

export type ShaderVariant = 'liquid' | 'grid' | 'drift' | 'dither'

export function emojiBackground(id: string) {
    const h = hashString(id)
    const hue = 130 + (h % 36)
    const chroma = 0.003 + (((h >> 8) % 10) / 10) * 0.005
    const lightness = 0.975 + (((h >> 16) % 10) / 10) * 0.02
    const darkLightness = 0.18 + (((h >> 16) % 10) / 10) * 0.06
    return {
        hue,
        light: `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue})`,
        dark: `oklch(${darkLightness.toFixed(3)} 0 0)`,
        lightRgb: oklchToSrgb(lightness, chroma, hue),
        darkRgb: oklchToSrgb(darkLightness, 0, 0),
    }
}

// --- BAYER DITHER ---

const BAYER_FLAT = new Float32Array([
    0 / 16, 8 / 16, 2 / 16, 10 / 16,
    12 / 16, 4 / 16, 14 / 16, 6 / 16,
    3 / 16, 11 / 16, 1 / 16, 9 / 16,
    15 / 16, 7 / 16, 13 / 16, 5 / 16,
])

function createColorLUT(hue: number, isDarkMode: boolean) {
    if (typeof document === 'undefined') return new Uint8ClampedArray(256 * 4)
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return new Uint8ClampedArray(256 * 4)
    for (let i = 0; i < 256; i++) {
        const t = i / 255
        let l, chr, h_val, alpha
        if (isDarkMode) {
            l = 0.28 + t * 0.15; chr = 0; h_val = 0; alpha = 0.08 + t * 0.25
        } else {
            l = 0.75 + t * 0.13; chr = 0.015 + t * 0.04; h_val = hue; alpha = 0.12 + t * 0.5
        }
        ctx.fillStyle = `oklch(${l.toFixed(3)} ${chr.toFixed(3)} ${h_val} / ${alpha.toFixed(3)})`
        ctx.fillRect(i, 0, 1, 1)
    }
    return ctx.getImageData(0, 0, 256, 1).data
}

function seededRandom(seed: number) {
    let s = seed
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}

interface GradientSource { cx: number; cy: number; radius: number; strength: number; phaseX: number; phaseY: number; speed: number }

function deriveGradientSources(id: string): GradientSource[] {
    const rng = seededRandom(hashString(id))
    const count = 3 + Math.floor(rng() * 3)
    const out: GradientSource[] = []
    for (let i = 0; i < count; i++) {
        out.push({
            cx: rng() * 0.8 + 0.1, cy: rng() * 0.8 + 0.1,
            radius: 0.4 + rng() * 0.5, strength: 0.4 + rng() * 0.5,
            phaseX: rng() * Math.PI * 2, phaseY: rng() * Math.PI * 2,
            speed: 0.12 + rng() * 0.25,
        })
    }
    return out
}

function BayerDither({ articleId, isDarkMode, hue }: { articleId: string; isDarkMode: boolean; hue: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const sources = useMemo(() => deriveGradientSources(articleId), [articleId])
    const colorLUT = useMemo(() => createColorLUT(hue, isDarkMode), [hue, isDarkMode])
    const stateRef = useRef({ startTime: 0, w: 0, h: 0, imgData: null as ImageData | null, visible: false })

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })
        if (!ctx) return

        const PIXEL = 4

        const renderFrame = (timestamp: number) => {
            const st = stateRef.current
            if (!st.visible) return
            if (st.startTime === 0) st.startTime = timestamp
            const cols = Math.floor(st.w / PIXEL)
            const rows = Math.floor(st.h / PIXEL)
            if (cols <= 0 || rows <= 0) return
            if (canvas.width !== cols || canvas.height !== rows) {
                canvas.width = cols; canvas.height = rows
                st.imgData = null
            }
            if (!st.imgData) st.imgData = ctx.createImageData(cols, rows)
            const pixels = st.imgData.data
            pixels.fill(0)
            const elapsed = (timestamp - st.startTime) / 1000
            for (let r = 0; r < rows; r++) {
                const ny = r / rows
                const bayerRow = (r % 4) << 2
                for (let c = 0; c < cols; c++) {
                    const nx = c / cols
                    let val = 0
                    for (let i = 0; i < sources.length; i++) {
                        const s = sources[i]
                        const sx = s.cx + Math.sin(elapsed * s.speed + s.phaseX) * 0.14
                        const sy = s.cy + Math.cos(elapsed * s.speed * 0.8 + s.phaseY) * 0.12
                        const dx = nx - sx, dy = ny - sy
                        val += s.strength * Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / s.radius)
                    }
                    if (val > 1) val = 1
                    const threshold = BAYER_FLAT[bayerRow + (c % 4)] * 0.85
                    if (isDarkMode ? val > threshold : val < threshold) {
                        const lIdx = (isDarkMode ? val : 1 - val) * 255 | 0
                        const pIdx = (r * cols + c) << 2
                        const base = lIdx << 2
                        pixels[pIdx] = colorLUT[base]; pixels[pIdx + 1] = colorLUT[base + 1]
                        pixels[pIdx + 2] = colorLUT[base + 2]; pixels[pIdx + 3] = colorLUT[base + 3]
                    }
                }
            }
            ctx.putImageData(st.imgData, 0, 0)
        }

        const ro = new ResizeObserver(([e]) => {
            stateRef.current.w = e.contentRect.width
            stateRef.current.h = e.contentRect.height
        })
        const io = new IntersectionObserver(([e]) => { stateRef.current.visible = e.isIntersecting }, { threshold: 0.01 })
        ro.observe(canvas)
        io.observe(canvas)
        const unsub = subscribe(renderFrame)
        return () => { unsub(); ro.disconnect(); io.disconnect() }
    }, [sources, colorLUT, isDarkMode])

    return (
        <canvas
            ref={canvasRef}
            className='pointer-events-none absolute inset-0 h-full w-full'
            style={{ imageRendering: 'pixelated', objectFit: 'fill' }}
            aria-hidden='true'
        />
    )
}

// --- WEBGL SHADERS ---

const VERT = `attribute vec2 a;varying vec2 v;
void main(){v=a*.5+.5;gl_Position=vec4(a,0,1);}`

const FRAG_LIQUID = `precision mediump float;
uniform float uTime;uniform vec3 uColor;varying vec2 v;
void main(){
  vec2 p=v*2.-1.;float t=uTime*.3;
  for(float i=1.;i<3.;i++){p.x+=.4/i*sin(i*2.*p.y+t);p.y+=.4/i*sin(i*2.*p.x+t);}
  gl_FragColor=vec4(mix(uColor,uColor*.96,smoothstep(.2,.9,length(p))),1);
}`

const FRAG_GRID = `precision mediump float;
uniform vec3 uColor;varying vec2 v;
void main(){
  vec2 g=step(.97,fract(v*50.));
  gl_FragColor=vec4(mix(uColor,uColor*.94,max(g.x,g.y)),1);
}`

const FRAG_DRIFT = `precision mediump float;
uniform float uTime;uniform vec3 uColor;varying vec2 v;
void main(){
  float m=sin(v.x*3.+uTime*.5)*cos(v.y*2.+uTime*.4);
  gl_FragColor=vec4(mix(uColor,uColor*.97,smoothstep(.3,.7,.5+.5*m)),1);
}`

const FRAG_MAP: Record<Exclude<ShaderVariant, 'dither'>, string> = { liquid: FRAG_LIQUID, grid: FRAG_GRID, drift: FRAG_DRIFT }

function initWebGL(canvas: HTMLCanvasElement, variant: ShaderVariant, rgb: [number, number, number]) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false })
    if (!gl) return null
    const compile = (type: number, src: string) => {
        const s = gl.createShader(type)!
        gl.shaderSource(s, src)
        gl.compileShader(s)
        return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG_MAP[variant]))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const pos = gl.getAttribLocation(prog, 'a')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)
    gl.useProgram(prog)
    gl.uniform3f(gl.getUniformLocation(prog, 'uColor'), rgb[0], rgb[1], rgb[2])
    const uTime = gl.getUniformLocation(prog, 'uTime')
    const offset = Math.random() * 100
    let disposed = false
    return {
        render(time: number) {
            if (disposed || gl.isContextLost()) return
            try {
                if (uTime) gl.uniform1f(uTime, time / 1000 + offset)
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
            } catch { /* context lost mid-frame */ }
        },
        resize(w: number, h: number) {
            if (disposed || gl.isContextLost()) return
            canvas.width = w; canvas.height = h
            gl.viewport(0, 0, w, h)
        },
        dispose() {
            if (disposed) return
            disposed = true
            if (!gl.isContextLost()) {
                gl.deleteBuffer(buf)
                gl.deleteProgram(prog)
            }
        }
    }
}

function useShaderCanvas(
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    variant: Exclude<ShaderVariant, 'dither'> | undefined,
    rgb: [number, number, number]
) {
    useEffect(() => {
        if (!variant) return
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = initWebGL(canvas, variant, rgb)
        if (!ctx) return

        const parent = canvas.parentElement!
        const dpr = Math.min(window.devicePixelRatio, 1.5)
        const isAnimated = variant !== 'grid'

        const fit = () => {
            const { width, height } = parent.getBoundingClientRect()
            const w = Math.round(width * dpr), h = Math.round(height * dpr)
            if (canvas.width !== w || canvas.height !== h) {
                ctx.resize(w, h)
                if (!isAnimated) ctx.render(0)
            }
        }
        const ro = new ResizeObserver(fit)
        ro.observe(parent)
        fit()

        if (!isAnimated) {
            ctx.render(0)
            return () => { ro.disconnect(); ctx.dispose() }
        }

        let visible = true
        const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting })
        io.observe(canvas)
        const unsub = subscribe((ts) => { if (visible) ctx.render(ts) })

        return () => { unsub(); io.disconnect(); ro.disconnect(); ctx.dispose() }
    }, [variant, rgb[0], rgb[1], rgb[2]])
}

export function EmojiCover({ emoji, articleId, className = '', isLink = false, variant, switchToDitherInDarkMode = false }: { emoji: string, articleId: string, className?: string, isLink?: boolean, variant?: ShaderVariant, switchToDitherInDarkMode?: boolean }) {
    const bg = useMemo(() => emojiBackground(articleId), [articleId])
    const { isDarkMode } = useDarkMode()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rgb = isDarkMode ? bg.darkRgb : bg.lightRgb
    const activeVariant = switchToDitherInDarkMode && isDarkMode ? 'dither' : variant
    const glVariant = activeVariant === 'dither' ? undefined : activeVariant
    useShaderCanvas(canvasRef, glVariant, rgb)

    return (
        <div
            className={cn('relative flex items-center justify-center rounded-4xl overflow-clip', className)}
            style={{ containerType: 'size', backgroundColor: isDarkMode ? bg.dark : bg.light }}
        >
            {glVariant && <canvas ref={canvasRef} className='absolute inset-0 w-full h-full pointer-events-none' />}
            {activeVariant === 'dither' && <BayerDither articleId={articleId} isDarkMode={isDarkMode} hue={bg.hue} />}
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
