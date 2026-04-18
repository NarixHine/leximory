'use client'

import { useRef, useCallback, useEffect, useReducer, useState, forwardRef, useImperativeHandle } from 'react'
import { motion, useAnimationControls, AnimatePresence } from 'framer-motion'

// Sprite sheet: 1408x768, 3 columns × 3 rows
const FRAME_ASPECT = 469 / 256

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
const FRAMES = {
    idle: '0% 0%',
    scramble1: '50% 0%',
    scramble2: '100% 0%',
    run1: '0% 50%',
    run2: '50% 50%',
    run3: '100% 50%',
    land1: '0% 100%',
    land2: '50% 100%',
}

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

interface FruitItem {
    id: string
    x: number
    y: number
}

interface LawnProps {
    onFruitReached?: (fruitId: string) => void
    fruits?: FruitItem[]
}

export interface LawnRef {
    moveTo: (xPercent: number, yPercent: number, onArrive?: () => void) => void
    moveNear: (xPercent: number, yPercent: number, bufferPx?: number, onArrive?: () => void) => void
}

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

export const Lawn = forwardRef<LawnRef, LawnProps>(function Lawn({ onFruitReached, fruits = [] }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const spriteRef = useRef<HTMLDivElement>(null)
    const controls = useAnimationControls()
    const positionRef = useRef({ x: 0, y: 0 })
    const isAnimatingRef = useRef(false)
    const initializedRef = useRef(false)
    const phaseRef = useRef<Phase>('idle')
    const animationFrameRef = useRef<number>(0)
    const particleIdRef = useRef(0)
    const reachedFruitsRef = useRef<Set<string>>(new Set())

    const [particles, setParticles] = useState<Particle[]>([])

    const catHeight = CAT_SIZE
    const catWidth = catHeight * FRAME_ASPECT

    const [catState, dispatch] = useReducer(catReducer, {
        isRunning: false,
        facingLeft: false,
    })

    const setFrame = (frame: string) => {
        if (spriteRef.current) {
            spriteRef.current.style.backgroundPosition = frame
        }
    }

    // Spawn dust particles behind the cat
    const spawnDustParticles = useCallback((x: number, y: number, dirX: number, dirY: number, facingLeft: boolean, rotationAngle: number) => {
        if (!DUST_ENABLED) return

        const newParticles: Particle[] = []
        const count = DUST_PARTICLE_COUNT

        // Convert rotation angle to radians
        const rotRad = (rotationAngle * Math.PI) / 180

        // Base offset from cat center (behind the cat)
        const baseOffsetX = -catWidth * 0.2 // behind
        const baseOffsetY = catHeight * 0.3 // near bottom

        // Rotate the offset based on cat's rotation
        // If facing left, we need to account for the flip
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

        // Remove particles after lifetime
        setTimeout(() => {
            setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)))
        }, DUST_LIFETIME)
    }, [catWidth, catHeight])

    // Check if cat reached any fruits
    const checkFruitCollisions = useCallback((currentX: number, currentY: number) => {
        if (!containerRef.current) return

        const rect = containerRef.current.getBoundingClientRect()
        const collisionRadius = catWidth * 0.6 // Collision radius around cat center

        fruits.forEach(fruit => {
            if (reachedFruitsRef.current.has(fruit.id)) return

            // Convert fruit percentage position to pixels
            const fruitX = (fruit.x / 100) * rect.width - catWidth / 2
            const fruitY = (fruit.y / 100) * rect.height - catHeight / 2

            // Calculate distance
            const dx = fruitX - currentX
            const dy = fruitY - currentY
            const distance = Math.sqrt(dx * dx + dy * dy)

            // Check collision
            if (distance < collisionRadius) {
                reachedFruitsRef.current.add(fruit.id)
                onFruitReached?.(fruit.id)
            }
        })
    }, [fruits, catWidth, catHeight, onFruitReached])

    useEffect(() => {
        if (containerRef.current && !initializedRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            const startX = rect.width / 2 - catWidth / 2
            const startY = rect.height / 2 - catHeight / 2
            positionRef.current = { x: startX, y: startY }
            controls.set({ x: startX, y: startY, rotate: 0 })
            initializedRef.current = true
        }
    }, [controls, catWidth, catHeight])

    // Core movement function - can be called from click handler or ref
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

        // Timing constants
        const accelFrameTime = 350
        const decelFrameTime = 350
        const landHoldTime = 150
        const turnDuration = 0.2

        // Phase thresholds
        const accelEnd = ACCEL_PHASE
        const decelStart = 1 - DECEL_PHASE

        // Direction unit vector
        const dirX = dx / distance
        const dirY = dy / distance

        dispatch({ type: 'START_MOVING', facingLeft: goingLeft })

        // === ACCELERATION PHASE (during turn) ===
        phaseRef.current = 'accelerating'
        let scrambleFrame = 0
        const scrambleFrames = [FRAMES.scramble1, FRAMES.scramble2]

        const scrambleInterval = setInterval(() => {
            if (phaseRef.current === 'accelerating') {
                setFrame(scrambleFrames[scrambleFrame % 2])
                scrambleFrame++
            }
        }, accelFrameTime)

        // Turn toward target
        await controls.start({
            rotate: angle,
            transition: { duration: turnDuration, ease: 'easeOut' }
        })

        // === MOVEMENT WITH TRUE PHASED VELOCITY ===
        let runFrame = 0
        const runFrames = [FRAMES.run1, FRAMES.run2, FRAMES.run3]
        let lastRunFrameTime = performance.now()
        let lastDecelFrameTime = performance.now()
        let lastDustTime = performance.now()
        let lastFootstepTime = performance.now()
        let decelFrame = 0
        const decelFrames = [FRAMES.run3, FRAMES.run2, FRAMES.run1, FRAMES.land1]

        const startX = currentPos.x
        const startY = currentPos.y
        let currentX = startX
        let currentY = startY
        let lastTime = performance.now()

        const animateMovement = (now: number) => {
            const deltaTime = (now - lastTime) / 1000 // seconds
            lastTime = now

            const traveledDx = currentX - startX
            const traveledDy = currentY - startY
            const traveledDist = Math.sqrt(traveledDx * traveledDx + traveledDy * traveledDy)
            const progress = Math.min(traveledDist / distance, 1)

            // Get velocity for current progress (pixels per second)
            const velocity = getVelocityAtProgress(progress, MAX_SPEED, accelEnd, decelStart)

            // Move cat
            const moveAmount = velocity * deltaTime
            const remainingDist = distance - traveledDist

            if (remainingDist > 1 && progress < 1) {
                const actualMove = Math.min(moveAmount, remainingDist)
                currentX += dirX * actualMove
                currentY += dirY * actualMove

                controls.set({ x: currentX, y: currentY })

                // Check for fruit collisions
                checkFruitCollisions(currentX, currentY)

                // Spawn dust particles while running
                if (phaseRef.current === 'running' || phaseRef.current === 'accelerating') {
                    if (now - lastDustTime >= DUST_SPAWN_RATE) {
                        spawnDustParticles(currentX, currentY, dirX, dirY, goingLeft, angle)
                        lastDustTime = now
                    }
                }

                // Update sprite based on phase
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
                // Arrived
                controls.set({ x: targetX, y: targetY })
                checkFruitCollisions(targetX, targetY)
                finishMovement()
            }
        }

        const finishMovement = async () => {
            clearInterval(scrambleInterval)
            cancelAnimationFrame(animationFrameRef.current)

            // Landing sequence
            setFrame(FRAMES.land1)
            phaseRef.current = 'landing'
            await new Promise(resolve => setTimeout(resolve, landHoldTime))

            setFrame(FRAMES.idle)
            phaseRef.current = 'idle'

            positionRef.current = { x: targetX, y: targetY }
            dispatch({ type: 'STOP_MOVING' })
            isAnimatingRef.current = false

            // Call the arrive callback
            onArrive?.()
        }

        animationFrameRef.current = requestAnimationFrame(animateMovement)
    }, [controls, catWidth, catHeight, spawnDustParticles, checkFruitCollisions])

    // Expose moveTo method via ref
    useImperativeHandle(ref, () => ({
        moveTo: (xPercent: number, yPercent: number, onArrive?: () => void) => {
            if (!containerRef.current) return

            const rect = containerRef.current.getBoundingClientRect()
            // Convert percentage to pixel coordinates (centered on the percentage point)
            const targetX = (xPercent / 100) * rect.width - catWidth / 2
            const targetY = (yPercent / 100) * rect.height - catHeight / 2

            moveToPosition(targetX, targetY, onArrive)
        },
        moveNear: (xPercent: number, yPercent: number, bufferPx: number = 80, onArrive?: () => void) => {
            if (!containerRef.current) return

            const rect = containerRef.current.getBoundingClientRect()
            // Convert percentage to pixel coordinates
            const targetX = (xPercent / 100) * rect.width - catWidth / 2
            const targetY = (yPercent / 100) * rect.height - catHeight / 2

            // Calculate current position
            const currentX = positionRef.current.x
            const currentY = positionRef.current.y

            // Calculate direction vector
            const dx = targetX - currentX
            const dy = targetY - currentY
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance <= bufferPx) {
                // Already close enough, just call callback
                onArrive?.()
                return
            }

            // Calculate stop position (buffer distance away from target)
            const ratio = (distance - bufferPx) / distance
            const stopX = currentX + dx * ratio
            const stopY = currentY + dy * ratio

            moveToPosition(stopX, stopY, onArrive)
        }
    }), [moveToPosition, catWidth, catHeight])

    const handleClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return

        const rect = containerRef.current.getBoundingClientRect()
        const targetX = e.clientX - rect.left - catWidth / 2
        const targetY = e.clientY - rect.top - catHeight / 2

        moveToPosition(targetX, targetY)
    }, [moveToPosition, catWidth, catHeight])

    return (
        <section
            className="relative w-full h-full select-none pointer-events-none"
            style={{
                backgroundImage: 'url(/assets/lawn.png)',
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            }}
        >
            <div
                ref={containerRef}
                onClick={handleClick}
                className="absolute inset-[5%] cursor-pointer pointer-events-auto"
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
                    <div
                        ref={spriteRef}
                        className="pointer-events-none"
                        style={{
                            width: '100%',
                            height: '100%',
                            backgroundImage: 'url(/assets/cat.png)',
                            backgroundSize: '300% 300%',
                            backgroundPosition: FRAMES.idle,
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))',
                        }}
                    />
                </motion.div>
            </div>
        </section>
    )
})
