'use client'

import { cn } from '@heroui/theme'
import React, { useRef, useMemo, useEffect, useState } from 'react'
import LoadingIndicatorWrapper from '../ui/loading-indicator-wrapper'
import { useDarkMode } from 'usehooks-ts'

// --- GLOBAL TICKER ---
type Task = (timestamp: number) => void
const subscribers = new Set<Task>()
let globalFrameId: number | null = null

function startGlobalTicker() {
    if (globalFrameId !== null) return
    const tick = (ts: number) => {
        for (const task of subscribers) task(ts)
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

// --- OKLCH → sRGB (Optimized for Uniforms) ---
function oklchToSrgb(L: number, C: number, H: number): [number, number, number] {
    const hRad = (H * Math.PI) / 180
    const a = C * Math.cos(hRad), b = C * Math.sin(hRad)
    const lp = L + 0.3963377774 * a + 0.2158037573 * b
    const mp = L - 0.1055613458 * a - 0.0638541728 * b
    const sp = L - 0.0894841775 * a - 1.2914855480 * b
    const l = lp ** 3, m = mp ** 3, s = sp ** 3
    const gamma = (x: number) => x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
    return [
        Math.max(0, Math.min(1, gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s))),
        Math.max(0, Math.min(1, gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s))),
        Math.max(0, Math.min(1, gamma(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)))
    ]
}

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
    const hue = 120 + (h % 55)
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

// --- BAYER DITHER (CPU Optimized) ---
const BAYER_FLAT = new Float32Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]).map(v => v / 16)

function createColorLUT(hue: number, isDarkMode: boolean): Uint32Array {
    const lut = new Uint32Array(256)
    const view = new Uint8Array(lut.buffer)
    for (let i = 0; i < 256; i++) {
        const t = i / 255
        const l = isDarkMode ? 0.28 + t * 0.15 : 0.75 + t * 0.13
        const chr = isDarkMode ? 0 : 0.015 + t * 0.04
        const alpha = isDarkMode ? 0.08 + t * 0.25 : 0.12 + t * 0.5
        const rgb = oklchToSrgb(l, chr, isDarkMode ? 0 : hue)
        const idx = i << 2
        view[idx] = rgb[0] * 255
        view[idx + 1] = rgb[1] * 255
        view[idx + 2] = rgb[2] * 255
        view[idx + 3] = alpha * 255
    }
    return lut
}

function BayerDither({ articleId, isDarkMode, hue }: { articleId: string; isDarkMode: boolean; hue: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const sources = useMemo(() => {
        const rng = (function (seed) {
            let s = seed
            return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
        })(hashString(articleId))
        return Array.from({ length: 3 + Math.floor(rng() * 3) }, () => ({
            cx: rng() * 0.8 + 0.1, cy: rng() * 0.8 + 0.1,
            radius: 0.4 + rng() * 0.5, strength: 0.4 + rng() * 0.5,
            phaseX: rng() * Math.PI * 2, phaseY: rng() * Math.PI * 2,
            speed: 0.12 + rng() * 0.25,
        }))
    }, [articleId])

    const colorLUT = useMemo(() => createColorLUT(hue, isDarkMode), [hue, isDarkMode])
    const stateRef = useRef({ startTime: 0, w: 0, h: 0, imgData: null as ImageData | null, buf32: null as Uint32Array | null, visible: false })

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })
        if (!ctx) return

        const PIXEL_SIZE = 4
        const renderFrame = (timestamp: number) => {
            const st = stateRef.current
            if (!st.visible || st.w === 0) return
            if (st.startTime === 0) st.startTime = timestamp

            const cols = (st.w / PIXEL_SIZE) | 0, rows = (st.h / PIXEL_SIZE) | 0
            if (canvas.width !== cols || canvas.height !== rows) {
                canvas.width = cols; canvas.height = rows
                st.imgData = ctx.createImageData(cols, rows)
                st.buf32 = new Uint32Array(st.imgData.data.buffer)
            }

            const { buf32, imgData } = st
            if (!buf32 || !imgData) return
            buf32.fill(0) // Clear buffer

            const elapsed = (timestamp - st.startTime) / 1000
            const srcLen = sources.length
            // Pre-calculate source positions for this frame
            const activeSources = sources.map(s => ({
                sx: s.cx + Math.sin(elapsed * s.speed + s.phaseX) * 0.14,
                sy: s.cy + Math.cos(elapsed * s.speed * 0.8 + s.phaseY) * 0.12,
                r: s.radius, str: s.strength
            }))

            for (let r = 0; r < rows; r++) {
                const ny = r / rows
                const bayerOff = (r % 4) << 2
                const rowOffset = r * cols
                for (let c = 0; c < cols; c++) {
                    const nx = c / cols
                    let val = 0
                    for (let i = 0; i < srcLen; i++) {
                        const s = activeSources[i]
                        const dx = nx - s.sx, dy = ny - s.sy
                        const dist = Math.sqrt(dx * dx + dy * dy)
                        if (dist < s.r) val += s.str * (1 - dist / s.r)
                    }
                    if (val > 1) val = 1

                    const threshold = BAYER_FLAT[bayerOff + (c % 4)] * 0.85
                    if (isDarkMode ? val > threshold : val < threshold) {
                        const lIdx = ((isDarkMode ? val : 1 - val) * 255) | 0
                        buf32[rowOffset + c] = colorLUT[lIdx]
                    }
                }
            }
            ctx.putImageData(imgData, 0, 0)
        }

        const ro = new ResizeObserver(([e]) => {
            stateRef.current.w = e.contentRect.width
            stateRef.current.h = e.contentRect.height
        })
        const io = new IntersectionObserver(([e]) => { stateRef.current.visible = e.isIntersecting }, { threshold: 0.01 })
        ro.observe(canvas); io.observe(canvas)
        const unsub = subscribe(renderFrame)
        return () => { unsub(); ro.disconnect(); io.disconnect() }
    }, [sources, colorLUT, isDarkMode])

    return <canvas ref={canvasRef} className='pointer-events-none absolute inset-0 h-full w-full' style={{ imageRendering: 'pixelated' }} aria-hidden='true' />
}

// --- WEBGL SECTION ---
const VERT = `attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0,1);}`
const FRAG_MAP = {
    liquid: `precision mediump float;uniform float uTime;uniform vec3 uColor;varying vec2 v;void main(){vec2 p=v*2.-1.;float t=uTime*.3;for(float i=1.;i<3.;i++){p.x+=.4/i*sin(i*2.*p.y+t);p.y+=.4/i*sin(i*2.*p.x+t);}gl_FragColor=vec4(mix(uColor,uColor*.96,smoothstep(.2,.9,length(p))),1);}`,
    grid: `precision mediump float;uniform vec3 uColor;uniform float uScale,uThick;varying vec2 v;void main(){vec2 g=step(uThick,fract(v*uScale));gl_FragColor=vec4(mix(uColor,uColor*.94,max(g.x,g.y)),1);}`,
    drift: `precision mediump float;uniform float uTime;uniform vec3 uColor;varying vec2 v;void main(){float m=sin(v.x*3.+uTime*.5)*cos(v.y*2.+uTime*.4);gl_FragColor=vec4(mix(uColor,uColor*.97,smoothstep(.3,.7,.5+.5*m)),1);}`
}

function useShaderCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>, variant: Exclude<ShaderVariant, 'dither'> | undefined, rgb: [number, number, number], articleId: string) {
    const [restartKey, setRestartKey] = useState(0)

    useEffect(() => {
        if (!variant || !canvasRef.current) return
        const canvas = canvasRef.current
        const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false })
        if (!gl) return

        // Register context-loss handlers before the isContextLost() guard so that
        // even an already-lost context (e.g. Safari evicted it) can be restored:
        // preventDefault() signals intent to restore; contextrestored bumps restartKey
        // which re-triggers this effect to fully reinitialize on the fresh context.
        const handleContextLost = (e: Event) => { e.preventDefault() }
        const handleContextRestored = () => { setRestartKey(k => k + 1) }
        canvas.addEventListener('webglcontextlost', handleContextLost)
        canvas.addEventListener('webglcontextrestored', handleContextRestored)

        if (gl.isContextLost()) {
            return () => {
                canvas.removeEventListener('webglcontextlost', handleContextLost)
                canvas.removeEventListener('webglcontextrestored', handleContextRestored)
            }
        }

        const compile = (t: number, s: string) => {
            const shader = gl.createShader(t)
            if (!shader) return null
            gl.shaderSource(shader, s); gl.compileShader(shader)
            return shader
        }
        const vs = compile(gl.VERTEX_SHADER, VERT)
        const fs = compile(gl.FRAGMENT_SHADER, FRAG_MAP[variant])
        if (!vs || !fs) return
        const prog = gl.createProgram()
        if (!prog) return
        gl.attachShader(prog, vs)
        gl.attachShader(prog, fs)
        gl.linkProgram(prog); gl.useProgram(prog)

        const buf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
        const pos = gl.getAttribLocation(prog, 'a')
        gl.enableVertexAttribArray(pos)
        gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

        gl.uniform3f(gl.getUniformLocation(prog, 'uColor'), rgb[0], rgb[1], rgb[2])
        if (variant === 'grid') {
            const h = hashString(articleId)
            gl.uniform1f(gl.getUniformLocation(prog, 'uScale'), 35 + (h % 31))
            gl.uniform1f(gl.getUniformLocation(prog, 'uThick'), 0.955 + ((h >> 4) % 10) / 333)
        }

        const uTime = gl.getUniformLocation(prog, 'uTime')
        const offset = Math.random() * 100
        const dpr = Math.min(window.devicePixelRatio, 1.5)
        let visible = true

        const render = (ts: number) => {
            if (!visible || gl.isContextLost()) return
            if (uTime) gl.uniform1f(uTime, ts / 1000 + offset)
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        }

        const ro = new ResizeObserver(([entry]) => {
            const w = Math.round(entry.contentRect.width * dpr), h = Math.round(entry.contentRect.height * dpr)
            canvas.width = w; canvas.height = h
            gl.viewport(0, 0, w, h)
            if (variant === 'grid') render(0)
        })
        if (canvas.parentElement) ro.observe(canvas.parentElement)

        const unsub = variant !== 'grid' ? subscribe(render) : () => { }
        const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting })
        io.observe(canvas)

        return () => {
            unsub(); ro.disconnect(); io.disconnect()
            canvas.removeEventListener('webglcontextlost', handleContextLost)
            canvas.removeEventListener('webglcontextrestored', handleContextRestored)
            gl.deleteBuffer(buf)
            gl.detachShader(prog, vs); gl.detachShader(prog, fs)
            gl.deleteShader(vs); gl.deleteShader(fs)
            gl.deleteProgram(prog)
        }
    }, [variant, articleId, rgb[0], rgb[1], rgb[2], restartKey])
}

export function EmojiCover({ emoji, articleId, className = '', isLink = false, variant, switchToDitherInDarkMode = false }: { emoji: string, articleId: string, className?: string, isLink?: boolean, variant?: ShaderVariant, switchToDitherInDarkMode?: boolean }) {
    const bg = useMemo(() => emojiBackground(articleId), [articleId])
    const { isDarkMode } = useDarkMode({ initializeWithValue: false })
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const activeVariant = (switchToDitherInDarkMode && isDarkMode) ? 'dither' : variant
    const rgb = isDarkMode ? bg.darkRgb : bg.lightRgb

    useShaderCanvas(canvasRef, activeVariant !== 'dither' ? activeVariant : undefined, rgb, articleId)

    return (
        <div
            className={cn('relative flex items-center justify-center rounded-4xl overflow-hidden', className)}
            style={{ containerType: 'size', backgroundColor: isDarkMode ? bg.dark : bg.light }}
        >
            {activeVariant && activeVariant !== 'dither' && <canvas ref={canvasRef} className='absolute inset-0 w-full h-full pointer-events-none' />}
            {activeVariant === 'dither' && <BayerDither articleId={articleId} isDarkMode={isDarkMode} hue={bg.hue} />}
            <div className='w-full h-full flex items-center justify-center z-10'>
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
