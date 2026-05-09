'use client'

import { useRef, useCallback, useLayoutEffect, useReducer, useState, forwardRef, useImperativeHandle } from 'react'
import { motion, useAnimationControls, AnimatePresence } from 'framer-motion'
import { CAT_FRAME_ASPECT, CAT_FRAMES, CatSprite } from './cat-sprite'
import { CatTaskPill, WordPill, StoryPill } from './lawn-items'
import { DiscreteProgress } from './discrete-progress'
import type { Lang } from '@repo/env/config'

// Tuned animation parameters
const CAT_SIZE = 100
const MAX_SPEED = 350
const RUN_FRAME_TIME = 90
const ACCEL_PHASE = 0.05
const DECEL_PHASE = 0.09

// Tuned dust particle parameters
const DUST_ENABLED = true
const DUST_SPAWN_RATE = 80
const DUST_PARTICLE_SIZE = 7
const DUST_PARTICLE_COUNT = 8
const DUST_SPREAD_ANGLE = 45
const DUST_VELOCITY = 60
const DUST_LIFETIME = 400
const DUST_OPACITY = 0.5

// Tuned audio parameters
const AUDIO_ENABLED = true
const AUDIO_VOLUME = 0.2
const AUDIO_PLAYBACK_RATE = 1

// Frame positions in the 3x3 grid
type Phase = 'idle' | 'accelerating' | 'running' | 'decelerating' | 'landing'

type CatAction =
    | { type: 'START_MOVING'; facingLeft: boolean }
    | { type: 'STOP_MOVING' }

interface CatState {
    isRunning: boolean
    facingLeft: boolean
}

interface Particle {
    id: number
    x: number
    y: number
    vx: number
    vy: number
    size: number
    opacity: number
    rotation: number
}

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

function catReducer(state: CatState, action: CatAction): CatState {
    switch (action.type) {
        case 'START_MOVING':
            return { isRunning: true, facingLeft: action.facingLeft }
        case 'STOP_MOVING':
            return { ...state, isRunning: false }
        default:
            return state
    }
}

// Custom velocity curve: accelerate → constant → decelerate
function getVelocityAtProgress(progress: number, maxSpeed: number, accelEnd: number, decelStart: number): number {
    if (progress < accelEnd) {
        const t = progress / accelEnd
        const minSpeed = maxSpeed * 0.15
        return minSpeed + (maxSpeed - minSpeed) * (t * t)
    } else if (progress < decelStart) {
        return maxSpeed
    } else {
        const t = (progress - decelStart) / (1 - decelStart)
        const minSpeed = maxSpeed * 0.1
        return minSpeed + (maxSpeed - minSpeed) * (1 - t * t)
    }
}

/**
 * Calculate the rendered bounds of an image when object-fit: contain is applied
 * within a container of given dimensions.
 */
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

/**
 * For portrait mode: the image is inside a flex centering wrapper and may
 * have rotation + scale transforms. We measure the wrapper's bounding rect.
 * Since the image is w-full with a fixed aspect ratio inside the wrapper,
 * and centered with flex, the bounds are simply the wrapper's content area.
 */
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
    const positionRef = useRef({ x: 0, y: 0 })
    const boundsRef = useRef<ImgBounds>({ left: 0, top: 0, width: 0, height: 0 })
    const resizeObserverRef = useRef<ResizeObserver | null>(null)
    const isAnimatingRef = useRef(false)
    const initializedRef = useRef(false)
    const phaseRef = useRef<Phase>('idle')
    const animationFrameRef = useRef<number>(0)
    const particleIdRef = useRef(0)

    const [particles, setParticles] = useState<Particle[]>([])
    const [imgBounds, setImgBounds] = useState<ImgBounds | null>(null)

    const catHeight = CAT_SIZE
    const catWidth = catHeight * CAT_FRAME_ASPECT

    const [catState, dispatch] = useReducer(catReducer, {
        isRunning: false,
        facingLeft: false,
    })

    const setFrame = (frame: string) => {
        if (spriteRef.current) {
            spriteRef.current.style.backgroundPosition = frame
        }
    }

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
                positionRef.current = { x: positionRef.current.x * rx, y: positionRef.current.y * ry }
                controls.set({ x: positionRef.current.x, y: positionRef.current.y })
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
                positionRef.current = { x: positionRef.current.x * rx, y: positionRef.current.y * ry }
                controls.set({ x: positionRef.current.x, y: positionRef.current.y })
            }
            boundsRef.current = bounds
            setImgBounds(bounds)
        }
    }, [isPortrait, controls])

    // Bounds measurement: reads container on mount, image dims on load
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

    // ResizeObserver on the outer section — calls measureBounds sync on mount
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

    // Initial positioning after bounds are first measured
    useLayoutEffect(() => {
        if (!imgBounds || initializedRef.current) return

        const bw = imgBounds.width
        const bh = imgBounds.height

        const startX = bw / 2 - catWidth / 2
        const startY = bh / 2 - catHeight / 2

        positionRef.current = { x: startX, y: startY }
        controls.set({ x: startX, y: startY, rotate: 0 })
        initializedRef.current = true
    }, [imgBounds, catWidth, catHeight, controls])

    // Spawn dust particles behind the cat
    const spawnDustParticles = useCallback((x: number, y: number, dirX: number, dirY: number, facingLeft: boolean, rotationAngle: number) => {
        if (!DUST_ENABLED) return

        const newParticles: Particle[] = []
        const count = DUST_PARTICLE_COUNT

        const rotRad = (rotationAngle * Math.PI) / 180

        const baseOffsetX = -catWidth * 0.2
        const baseOffsetY = catHeight * 0.3

        const flipMultiplier = facingLeft ? -1 : 1
        const rotatedOffsetX = baseOffsetX * Math.cos(rotRad) - baseOffsetY * Math.sin(rotRad)
        const rotatedOffsetY = baseOffsetX * Math.sin(rotRad) + baseOffsetY * Math.cos(rotRad)

        for (let i = 0; i < count; i++) {
            const spreadRad = (DUST_SPREAD_ANGLE * Math.PI) / 180
            const baseAngle = Math.atan2(-dirY, -dirX)
            const angle = baseAngle + (Math.random() - 0.5) * spreadRad

            const speed = DUST_VELOCITY * (0.5 + Math.random() * 0.5)

            newParticles.push({
                id: particleIdRef.current++,
                x: x + catWidth / 2 + rotatedOffsetX * flipMultiplier + (Math.random() - 0.5) * 10,
                y: y + catHeight / 2 + rotatedOffsetY + (Math.random() - 0.5) * 5,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 20,
                size: DUST_PARTICLE_SIZE * (0.6 + Math.random() * 0.8),
                opacity: DUST_OPACITY * (0.6 + Math.random() * 0.4),
                rotation: Math.random() * 360,
            })
        }

        setParticles(prev => [...prev, ...newParticles])

        setTimeout(() => {
            setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)))
        }, DUST_LIFETIME)
    }, [catWidth, catHeight])

    // Core movement function
    const moveToPosition = useCallback(async (targetX: number, targetY: number, onArrive?: () => void) => {
        if (!containerRef.current || isAnimatingRef.current) return

        const currentPos = positionRef.current
        const dx = targetX - currentPos.x
        const dy = targetY - currentPos.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < 20) {
            onArrive?.()
            return
        }

        isAnimatingRef.current = true

        const goingLeft = dx < 0
        let angle = Math.atan2(dy, dx) * (180 / Math.PI)
        if (goingLeft) {
            angle = Math.atan2(dy, -dx) * (180 / Math.PI)
        }
        angle = Math.max(-75, Math.min(75, angle))

        const accelFrameTime = 350
        const decelFrameTime = 350
        const landHoldTime = 150
        const turnDuration = 0.2

        const accelEnd = ACCEL_PHASE
        const decelStart = 1 - DECEL_PHASE

        const dirX = dx / distance
        const dirY = dy / distance

        dispatch({ type: 'START_MOVING', facingLeft: goingLeft })

        phaseRef.current = 'accelerating'
        let scrambleFrame = 0
        const scrambleFrames = [CAT_FRAMES.scramble1, CAT_FRAMES.scramble2]

        const scrambleInterval = setInterval(() => {
            if (phaseRef.current === 'accelerating') {
                setFrame(scrambleFrames[scrambleFrame % 2])
                scrambleFrame++
            }
        }, accelFrameTime)

        await controls.start({
            rotate: angle,
            transition: { duration: turnDuration, ease: 'easeOut' }
        })

        let runFrame = 0
        const runFrames = [CAT_FRAMES.run1, CAT_FRAMES.run2, CAT_FRAMES.run3]
        let lastRunFrameTime = performance.now()
        let lastDecelFrameTime = performance.now()
        let lastDustTime = performance.now()
        let decelFrame = 0
        const decelFrames = [CAT_FRAMES.run3, CAT_FRAMES.run2, CAT_FRAMES.run1, CAT_FRAMES.land1]

        const startX = currentPos.x
        const startY = currentPos.y
        let currentX = startX
        let currentY = startY
        let lastTime = performance.now()

        const animateMovement = (now: number) => {
            const deltaTime = (now - lastTime) / 1000
            lastTime = now

            const traveledDx = currentX - startX
            const traveledDy = currentY - startY
            const traveledDist = Math.sqrt(traveledDx * traveledDx + traveledDy * traveledDy)
            const progress = Math.min(traveledDist / distance, 1)

            const velocity = getVelocityAtProgress(progress, MAX_SPEED, accelEnd, decelStart)

            const moveAmount = velocity * deltaTime
            const remainingDist = distance - traveledDist

            if (remainingDist > 1 && progress < 1) {
                const actualMove = Math.min(moveAmount, remainingDist)
                currentX += dirX * actualMove
                currentY += dirY * actualMove

                controls.set({ x: currentX, y: currentY })

                if (phaseRef.current === 'running' || phaseRef.current === 'accelerating') {
                    if (now - lastDustTime >= DUST_SPAWN_RATE) {
                        spawnDustParticles(currentX, currentY, dirX, dirY, goingLeft, angle)
                        lastDustTime = now
                    }
                }

                if (progress < accelEnd) {
                    phaseRef.current = 'accelerating'
                } else if (progress < decelStart) {
                    if (now - lastRunFrameTime >= RUN_FRAME_TIME) {
                        setFrame(runFrames[runFrame % 3])
                        runFrame++
                        lastRunFrameTime = now
                    }
                } else {
                    if (phaseRef.current !== 'decelerating') {
                        phaseRef.current = 'decelerating'
                        decelFrame = 0
                        lastDecelFrameTime = now
                    }
                    if (now - lastDecelFrameTime >= decelFrameTime) {
                        if (decelFrame < decelFrames.length) {
                            setFrame(decelFrames[decelFrame])
                            decelFrame++
                        }
                        lastDecelFrameTime = now
                    }
                }

                animationFrameRef.current = requestAnimationFrame(animateMovement)
            } else {
                controls.set({ x: targetX, y: targetY })
                finishMovement()
            }
        }

        const finishMovement = async () => {
            clearInterval(scrambleInterval)
            cancelAnimationFrame(animationFrameRef.current)

            setFrame(CAT_FRAMES.land1)
            phaseRef.current = 'landing'
            await new Promise(resolve => setTimeout(resolve, landHoldTime))

            setFrame(CAT_FRAMES.idle)
            phaseRef.current = 'idle'

            positionRef.current = { x: targetX, y: targetY }
            dispatch({ type: 'STOP_MOVING' })
            isAnimatingRef.current = false

            onArrive?.()
        }

        animationFrameRef.current = requestAnimationFrame(animateMovement)
    }, [controls, catWidth, catHeight, spawnDustParticles])

    // Expose moveTo / moveNear via ref
    useImperativeHandle(ref, () => ({
        moveTo: (xPercent: number, yPercent: number, onArrive?: () => void) => {
            const bounds = boundsRef.current
            if (!bounds.width || !bounds.height) return

            // Cat is child of the interactive div → use image-relative coords
            const targetX = (xPercent / 100) * bounds.width - catWidth / 2
            const targetY = (yPercent / 100) * bounds.height - catHeight / 2

            moveToPosition(targetX, targetY, onArrive)
        },
        moveNear: (xPercent: number, yPercent: number, bufferPx: number = 80, onArrive?: () => void) => {
            const bounds = boundsRef.current
            if (!bounds.width || !bounds.height) return

            const targetX = (xPercent / 100) * bounds.width - catWidth / 2
            const targetY = (yPercent / 100) * bounds.height - catHeight / 2

            const currentX = positionRef.current.x
            const currentY = positionRef.current.y

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

            moveToPosition(stopX, stopY, onArrive)
        }
    }), [moveToPosition, catWidth, catHeight])

    const handleClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
        const bounds = boundsRef.current
        if (!bounds.width || !bounds.height) return

        const rect = e.currentTarget.getBoundingClientRect()
        const targetX = e.clientX - rect.left - catWidth / 2
        const targetY = e.clientY - rect.top - catHeight / 2

        moveToPosition(targetX, targetY)
    }, [moveToPosition, catWidth, catHeight])

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
            {/* Lawn image — structural <img>, not a CSS background */}
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

            {/* Interactive area — exactly matches the image's rendered bounds */}
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
                    {/* Dust particles layer */}
                    <AnimatePresence>
                        {particles.map(particle => (
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

                    {/* Progress indicator */}
                    {progress && (
                        <div className="absolute left-1/2 -top-10 min-[500px]:-top-3 -translate-x-1/2 z-40">
                            <DiscreteProgress
                                value={progress.value}
                                conversationCompleted={progress.conversationCompleted}
                                lang={progress.lang as Lang}
                                showLang={false}
                            />
                        </div>
                    )}

                    {/* Items layer */}
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

                    {/* Cat sprite */}
                    <motion.div
                        animate={controls}
                        className="absolute origin-center pointer-events-none z-50"
                        style={{
                            width: catWidth,
                            height: catHeight,
                            scaleX: catState.facingLeft ? -1 : 1,
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
