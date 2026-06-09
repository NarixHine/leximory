'use client'

import { useRef, useCallback, useLayoutEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { motion, useAnimationControls, AnimatePresence } from 'framer-motion'
import { CAT_FRAME_ASPECT, CAT_FRAMES, CatSprite } from './cat-sprite'
import { CatTaskPill, WordPill, StoryPill } from './lawn-items'
import { DiscreteProgress } from './discrete-progress'
import {
    useCatMovement,
    CAT_SIZE,
    DUST_LIFETIME,
    DUST_PARTICLE_SIZE,
} from '@/lib/hooks/use-cat-movement'
import type { Lang } from '@repo/env/config'

export interface LawnItem {
    id: string
    type: 'story' | 'translation' | 'conversation'
    label: string
    x: number
    y: number
    displayX: number
    displayY: number
    delay: number
    isLocked?: boolean
    isCompleted?: boolean
    isActive?: boolean
}

interface ProgressData {
    value: number
    conversationCompleted?: boolean
    lang?: string
}

interface LawnProps {
    items?: LawnItem[]
    onItemClick?: (item: LawnItem) => void
    isPortrait?: boolean
    progress?: ProgressData
}

export interface LawnRef {
    moveTo: (xPercent: number, yPercent: number, onArrive?: () => void) => void
    moveNear: (xPercent: number, yPercent: number, bufferPx?: number, onArrive?: () => void) => void
}

interface ImgBounds { left: number; top: number; width: number; height: number }

function calcContainedBounds(
    containerW: number, containerH: number,
    naturalW: number, naturalH: number
): ImgBounds {
    if (!containerW || !containerH || !naturalW || !naturalH) {
        return { left: 0, top: 0, width: containerW, height: containerH }
    }
    const scale = Math.min(containerW / naturalW, containerH / naturalH)
    const w = naturalW * scale
    const h = naturalH * scale
    const left = (containerW - w) / 2
    const top = (containerH - h) / 2
    return { left, top, width: w, height: h }
}

function calcPortraitBounds(
    wrapperW: number, wrapperH: number
): ImgBounds {
    return { left: 0, top: 0, width: wrapperW, height: wrapperH }
}

export const Lawn = forwardRef<LawnRef, LawnProps>(function Lawn({
    items = [],
    onItemClick,
    isPortrait = false,
    progress,
}, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const spriteRef = useRef<HTMLDivElement>(null)
    const imgWrapperRef = useRef<HTMLDivElement>(null)
    const imgRef = useRef<HTMLImageElement>(null)
    const controls = useAnimationControls()
    const boundsRef = useRef<ImgBounds>({ left: 0, top: 0, width: 0, height: 0 })
    const resizeObserverRef = useRef<ResizeObserver | null>(null)
    const initializedRef = useRef(false)

    const [imgBounds, setImgBounds] = useState<ImgBounds | null>(null)

    const catHeight = CAT_SIZE
    const catWidth = catHeight * CAT_FRAME_ASPECT

    const catMovement = useCatMovement({
        catWidth,
        catHeight,
        setPosition: useCallback((x: number, y: number, rotation?: number) => {
            controls.set(rotation !== undefined ? { x, y, rotate: rotation } : { x, y })
        }, [controls]),
        animateRotation: useCallback(async (angle: number) => {
            await controls.start({ rotate: angle, transition: { duration: 0.2, ease: 'easeOut' } })
        }, [controls]),
        setFrame: useCallback((frame: string) => {
            if (spriteRef.current) {
                spriteRef.current.style.backgroundPosition = frame
            }
        }, []),
    })

    const isAnimatingRef = catMovement.isAnimatingRef

    const updateBounds = useCallback(() => {
        const prev = boundsRef.current

        if (isPortrait) {
            const wrapper = imgWrapperRef.current
            if (!wrapper) return
            const rect = wrapper.getBoundingClientRect()
            const bounds = calcPortraitBounds(rect.width, rect.height)

            if (!isAnimatingRef.current && prev.width > 0 && prev.height > 0 && initializedRef.current) {
                const rx = bounds.width / prev.width
                const ry = bounds.height / prev.height
                catMovement.positionRef.current = {
                    x: catMovement.positionRef.current.x * rx,
                    y: catMovement.positionRef.current.y * ry,
                }
                controls.set({ x: catMovement.positionRef.current.x, y: catMovement.positionRef.current.y })
            }
            boundsRef.current = bounds
            setImgBounds(bounds)
        } else {
            const node = containerRef.current
            const img = imgRef.current
            if (!node) return

            const rect = node.getBoundingClientRect()
            const bounds = calcContainedBounds(
                rect.width, rect.height,
                img?.naturalWidth ?? 0, img?.naturalHeight ?? 0
            )

            if (!isAnimatingRef.current && prev.width > 0 && prev.height > 0 && initializedRef.current) {
                const rx = bounds.width / prev.width
                const ry = bounds.height / prev.height
                catMovement.positionRef.current = {
                    x: catMovement.positionRef.current.x * rx,
                    y: catMovement.positionRef.current.y * ry,
                }
                controls.set({ x: catMovement.positionRef.current.x, y: catMovement.positionRef.current.y })
            }
            boundsRef.current = bounds
            setImgBounds(bounds)
        }
    }, [isPortrait, controls, catMovement.positionRef, isAnimatingRef])

    const measureBounds = useCallback(() => {
        if (isPortrait) {
            const wrapper = imgWrapperRef.current
            if (!wrapper) return
            const rect = wrapper.getBoundingClientRect()
            boundsRef.current = calcPortraitBounds(rect.width, rect.height)
            setImgBounds(boundsRef.current)
        } else {
            const node = containerRef.current
            const img = imgRef.current
            if (!node) return
            const rect = node.getBoundingClientRect()
            boundsRef.current = calcContainedBounds(
                rect.width, rect.height,
                img?.naturalWidth ?? 0, img?.naturalHeight ?? 0
            )
            setImgBounds(boundsRef.current)
        }
    }, [isPortrait])

    useLayoutEffect(() => {
        const node = containerRef.current
        if (!node) return

        measureBounds()

        const observer = new ResizeObserver(() => {
            updateBounds()
        })
        observer.observe(node)
        resizeObserverRef.current = observer

        return () => observer.disconnect()
    }, [measureBounds, updateBounds])

    const onImgRef = useCallback((el: HTMLImageElement | null) => {
        imgRef.current = el
        if (el?.complete && el.naturalWidth > 0) {
            updateBounds()
        }
    }, [updateBounds])

    useLayoutEffect(() => {
        if (!imgBounds || initializedRef.current) return

        const bw = imgBounds.width
        const bh = imgBounds.height

        const startX = bw / 2 - catWidth / 2
        const startY = bh / 2 - catHeight / 2

        catMovement.setInitialPosition(startX, startY)
        controls.set({ x: startX, y: startY, rotate: 0 })
        initializedRef.current = true
    }, [imgBounds, catWidth, catHeight, controls, catMovement])

    useImperativeHandle(ref, () => ({
        moveTo: (xPercent: number, yPercent: number, onArrive?: () => void) => {
            const bounds = boundsRef.current
            if (!bounds.width || !bounds.height) return

            const targetX = (xPercent / 100) * bounds.width - catWidth / 2
            const targetY = (yPercent / 100) * bounds.height - catHeight / 2

            catMovement.moveToPosition(targetX, targetY, onArrive)
        },
        moveNear: (xPercent: number, yPercent: number, bufferPx: number = 80, onArrive?: () => void) => {
            const bounds = boundsRef.current
            if (!bounds.width || !bounds.height) return

            const targetX = (xPercent / 100) * bounds.width - catWidth / 2
            const targetY = (yPercent / 100) * bounds.height - catHeight / 2

            const currentX = catMovement.positionRef.current.x
            const currentY = catMovement.positionRef.current.y

            const dx = targetX - currentX
            const dy = targetY - currentY
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance <= bufferPx) {
                onArrive?.()
                return
            }

            const ratio = (distance - bufferPx) / distance
            const stopX = currentX + dx * ratio
            const stopY = currentY + dy * ratio

            catMovement.moveToPosition(stopX, stopY, onArrive)
        }
    }), [catMovement, catWidth, catHeight])

    const handleClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
        const bounds = boundsRef.current
        if (!bounds.width || !bounds.height) return

        const rect = e.currentTarget.getBoundingClientRect()
        const targetX = e.clientX - rect.left - catWidth / 2
        const targetY = e.clientY - rect.top - catHeight / 2

        catMovement.moveToPosition(targetX, targetY)
    }, [catMovement, catWidth, catHeight])

    const lawnLightSrc = '/assets/lawn.webp'
    const lawnDarkSrc = '/assets/lawn-night.webp'

    const [isDark, setIsDark] = useState(() => {
        if (typeof document !== 'undefined') {
            return document.documentElement.classList.contains('dark')
        }
        return false
    })

    useLayoutEffect(() => {
        const el = document.documentElement
        const check = () => setIsDark(el.classList.contains('dark'))
        const observer = new MutationObserver(() => check())
        observer.observe(el, { attributes: true, attributeFilter: ['class'] })
        return () => observer.disconnect()
    }, [])

    const lawnSrc = isDark ? lawnDarkSrc : lawnLightSrc

    return (
        <section
            ref={containerRef}
            className="relative h-full w-full select-none overflow-visible"
        >
            {isPortrait ? (
                <div
                    ref={imgWrapperRef}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible"
                >
                    <img
                        ref={onImgRef}
                        src={lawnSrc}
                        alt="Lawn"
                        className="w-full aspect-43/24 rotate-90 max-[500px]:scale-180 scale-150 object-contain select-none"
                        onLoad={updateBounds}
                    />
                </div>
            ) : (
                <img
                    ref={onImgRef}
                    src={lawnSrc}
                    alt="Lawn"
                    className="pointer-events-none absolute inset-0 w-full h-full object-contain select-none"
                    onLoad={updateBounds}
                />
            )}

            {imgBounds && (
                <div
                    onClick={handleClick}
                    className="absolute cursor-pointer pointer-events-auto"
                    style={{
                        left: imgBounds.left,
                        top: imgBounds.top,
                        width: imgBounds.width,
                        height: imgBounds.height,
                    }}
                >
                    <AnimatePresence>
                        {catMovement.particles.map(particle => (
                            <motion.div
                                key={particle.id}
                                initial={{
                                    x: particle.x,
                                    y: particle.y,
                                    opacity: particle.opacity,
                                    scale: 1,
                                    rotate: particle.rotation,
                                }}
                                animate={{
                                    x: particle.x + particle.vx * (DUST_LIFETIME / 1000),
                                    y: particle.y + particle.vy * (DUST_LIFETIME / 1000),
                                    opacity: 0,
                                    scale: 0.3,
                                    rotate: particle.rotation + 180,
                                }}
                                exit={{ opacity: 0 }}
                                transition={{
                                    duration: DUST_LIFETIME / 1000,
                                    ease: 'easeOut',
                                }}
                                className="absolute pointer-events-none rounded-full"
                                style={{
                                    width: particle.size,
                                    height: particle.size,
                                    background: 'radial-gradient(circle, rgba(180, 160, 120, 0.8) 0%, rgba(160, 140, 100, 0.4) 50%, transparent 70%)',
                                    filter: 'blur(1px)',
                                }}
                            />
                        ))}
                    </AnimatePresence>

                    {progress && (
                        <div className="absolute left-1/2 -top-22 min-[500px]:-top-3 -translate-x-1/2 z-40">
                            <DiscreteProgress
                                showIcon={false}
                                value={progress.value}
                                conversationCompleted={progress.conversationCompleted}
                                lang={progress.lang as Lang}
                                showLang={false}
                                showThresholdLabels
                            />
                        </div>
                    )}

                    <AnimatePresence>
                        {items.map((item) => (
                            item.type === 'story' ? (
                                <StoryPill
                                    key={item.id}
                                    id={item.id}
                                    x={item.displayX}
                                    y={item.displayY}
                                    delay={item.delay}
                                    onClick={() => onItemClick?.(item)}
                                    isActive={item.isActive}
                                />
                            ) : item.type === 'conversation' ? (
                                <CatTaskPill
                                    key={item.id}
                                    id={item.id}
                                    x={item.displayX}
                                    y={item.displayY}
                                    delay={item.delay}
                                    onClick={() => onItemClick?.(item)}
                                    isLocked={item.isLocked ?? false}
                                    isCompleted={item.isCompleted ?? false}
                                />
                            ) : (
                                <WordPill
                                    key={item.id}
                                    id={item.id}
                                    word={item.label}
                                    x={item.displayX}
                                    y={item.displayY}
                                    delay={item.delay}
                                    onClick={() => onItemClick?.(item)}
                                    isCompleted={item.isCompleted ?? false}
                                    isActive={item.isActive}
                                />
                            )
                        ))}
                    </AnimatePresence>

                    <motion.div
                        animate={controls}
                        className="absolute origin-center pointer-events-none z-50"
                        style={{
                            width: catWidth,
                            height: catHeight,
                            scaleX: catMovement.facingLeft ? -1 : 1,
                        }}
                    >
                        <CatSprite
                            ref={spriteRef}
                            className="pointer-events-none w-full h-full dark:brightness-60"
                            style={{
                                backgroundPosition: CAT_FRAMES.idle,
                            }}
                        />
                    </motion.div>
                </div>
            )}
        </section>
    )
})
