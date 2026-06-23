'use client'

import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { motion, useAnimationControls, AnimatePresence } from 'framer-motion'
import { Card, CardBody } from '@heroui/card'
import { CatSprite, CAT_FRAME_ASPECT, CAT_FRAMES } from '@/app/review/components/cat-sprite'
import { WordPill } from '@/app/review/components/lawn-items'
import { useCatMovement, CAT_SIZE, DUST_LIFETIME } from '@/lib/hooks/use-cat-movement'

const PILLS = [
    { label: 'feline', x: 15, y: 32 },
    { label: 'linguistics', x: 43, y: 40 },
    { label: 'purity', x: 70, y: 23 },
    { label: 'knowledge', x: 50, y: 70 },
    { label: 'naïveté', x: 27, y: 72 },
] as const

const IDLE_WAIT_MIN = 2000
const IDLE_WAIT_MAX = 4000

interface ImgBounds {
    left: number
    top: number
    width: number
    height: number
}

function calcContainedBounds(
    containerW: number,
    containerH: number,
    naturalW: number,
    naturalH: number,
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

function getTarget(
    bounds: ImgBounds,
    catWidth: number,
    catHeight: number,
): { x: number; y: number } {
    if (Math.random() < 0.6) {
        const pill = PILLS[Math.floor(Math.random() * PILLS.length)]
        return {
            x: (pill.x / 100) * bounds.width - catWidth / 2,
            y: (pill.y / 100) * bounds.height - catHeight / 2,
        }
    }
    return {
        x: (0.1 + Math.random() * 0.8) * bounds.width - catWidth / 2,
        y: (0.15 + Math.random() * 0.7) * bounds.height - catHeight / 2,
    }
}

export default function HeroLawn() {
    const containerRef = useRef<HTMLDivElement>(null)
    const spriteRef = useRef<HTMLDivElement>(null)
    const imgRef = useRef<HTMLImageElement>(null)
    const controls = useAnimationControls()
    const boundsRef = useRef<ImgBounds>({ left: 0, top: 0, width: 0, height: 0 })
    const [imgBounds, setImgBounds] = useState<ImgBounds | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const mountedRef = useRef(true)
    const wanderRef = useRef<() => void>(() => {})
    const movementRef = useRef<ReturnType<typeof useCatMovement> | null>(null)

    const [isDark, setIsDark] = useState(false)

    useLayoutEffect(() => {
        const el = document.documentElement
        setIsDark(el.classList.contains('dark'))
        const observer = new MutationObserver(() => setIsDark(el.classList.contains('dark')))
        observer.observe(el, { attributes: true, attributeFilter: ['class'] })
        return () => observer.disconnect()
    }, [])

    const catHeight = CAT_SIZE
    const catWidth = catHeight * CAT_FRAME_ASPECT

    const catMovement = useCatMovement({
        catWidth,
        catHeight,
        setPosition: useCallback(
            (x: number, y: number, rotation?: number) => {
                controls.set(rotation !== undefined ? { x, y, rotate: rotation } : { x, y })
            },
            [controls],
        ),
        animateRotation: useCallback(
            async (angle: number) => {
                await controls.start({
                    rotate: angle,
                    transition: { duration: 0.2, ease: 'easeOut' },
                })
            },
            [controls],
        ),
        setFrame: useCallback((frame: string) => {
            if (spriteRef.current) {
                spriteRef.current.style.backgroundPosition = frame
            }
        }, []),
    })

    const measureBounds = useCallback(() => {
        const node = containerRef.current
        const img = imgRef.current
        if (!node) return
        const rect = node.getBoundingClientRect()
        const bounds = calcContainedBounds(
            rect.width,
            rect.height,
            img?.naturalWidth ?? 0,
            img?.naturalHeight ?? 0,
        )
        boundsRef.current = bounds
        setImgBounds(bounds)
        return bounds
    }, [])

    const updateBounds = useCallback(() => {
        measureBounds()
    }, [measureBounds])

    useLayoutEffect(() => {
        measureBounds()
        const node = containerRef.current
        if (!node) return
        const observer = new ResizeObserver(() => updateBounds())
        observer.observe(node)
        return () => observer.disconnect()
    }, [measureBounds, updateBounds])

    const onImgRef = useCallback(
        (el: HTMLImageElement | null) => {
            imgRef.current = el
            if (el?.complete && el.naturalWidth > 0) {
                updateBounds()
            }
        },
        [updateBounds],
    )

    const initializedRef = useRef(false)

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

    const wander = useCallback(() => {
        if (!mountedRef.current) return

        const cm = movementRef.current
        if (!cm) return

        const bounds = boundsRef.current
        if (!bounds.width || !bounds.height) {
            timerRef.current = setTimeout(() => wanderRef.current(), 500)
            return
        }

        if (cm.isAnimatingRef.current) {
            timerRef.current = setTimeout(() => wanderRef.current(), 500)
            return
        }

        const target = getTarget(bounds, catWidth, catHeight)

        const currentX = cm.positionRef.current.x
        const currentY = cm.positionRef.current.y
        const dx = target.x - currentX
        const dy = target.y - currentY
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < 30) {
            timerRef.current = setTimeout(
                () => wanderRef.current(),
                IDLE_WAIT_MIN + Math.random() * (IDLE_WAIT_MAX - IDLE_WAIT_MIN),
            )
            return
        }

        cm.moveToPosition(target.x, target.y, () => {
            if (!mountedRef.current) return
            const wait = IDLE_WAIT_MIN + Math.random() * (IDLE_WAIT_MAX - IDLE_WAIT_MIN)
            timerRef.current = setTimeout(() => wanderRef.current(), wait)
        })
    }, [catWidth, catHeight])

    movementRef.current = catMovement
    wanderRef.current = wander

    useEffect(() => {
        const startIfReady = () => {
            if (!mountedRef.current) return
            if (initializedRef.current) {
                timerRef.current = setTimeout(() => wanderRef.current(), 1500)
            } else {
                timerRef.current = setTimeout(startIfReady, 100)
            }
        }
        startIfReady()
        return () => {
            mountedRef.current = false
            clearTimeout(timerRef.current)
            catMovement.cancelMovement()
        }
    }, [catMovement.cancelMovement])

    const lawnSrc = isDark ? '/assets/lawn-night.webp' : '/assets/lawn.webp'

    return (
        <Card
            shadow='none'
            className='w-full bg-[#eff8ef] dark:bg-secondary-100 rounded-4xl overflow-hidden sm:p-10'
        >
            <CardBody className='p-0'>
                <section
                    ref={containerRef}
                    className='relative w-full aspect-video min-h-65 overflow-hidden select-none'
                >
                    <img
                        ref={onImgRef}
                        src={lawnSrc}
                        alt=''
                        className='absolute inset-0 w-full h-full object-contain select-none'
                        onLoad={updateBounds}
                    />

                    {imgBounds && (
                        <div
                            className='absolute'
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
                                        className='absolute pointer-events-none rounded-full'
                                        style={{
                                            width: particle.size,
                                            height: particle.size,
                                            background:
                                                'radial-gradient(circle, rgba(180, 160, 120, 0.8) 0%, rgba(160, 140, 100, 0.4) 50%, transparent 70%)',
                                            filter: 'blur(1px)',
                                        }}
                                    />
                                ))}
                            </AnimatePresence>

                            <AnimatePresence>
                                {PILLS.map((pill, i) => (
                                    <WordPill
                                        key={pill.label}
                                        id={`hero-pill-${pill.label}`}
                                        word={pill.label}
                                        x={pill.x}
                                        y={pill.y}
                                        delay={i * 0.15}
                                        isCompleted={false}
                                    />
                                ))}
                            </AnimatePresence>

                            <motion.div
                                animate={controls}
                                className='absolute origin-center pointer-events-none z-50'
                                style={{
                                    width: catWidth,
                                    height: catHeight,
                                    scaleX: catMovement.facingLeft ? -1 : 1,
                                }}
                            >
                                <CatSprite
                                    ref={spriteRef}
                                    className='pointer-events-none w-full h-full dark:brightness-60'
                                    style={{
                                        backgroundPosition: CAT_FRAMES.idle,
                                    }}
                                />
                            </motion.div>
                        </div>
                    )}
                </section>
            </CardBody>
        </Card>
    )
}
