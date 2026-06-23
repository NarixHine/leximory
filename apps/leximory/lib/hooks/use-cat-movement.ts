'use client'

import { useRef, useCallback, useReducer, useState, useMemo } from 'react'
import { CAT_FRAMES } from '@/app/review/components/cat-sprite'

export const CAT_SIZE = 100
export const MAX_SPEED = 350
export const RUN_FRAME_TIME = 90
export const ACCEL_PHASE = 0.05
export const DECEL_PHASE = 0.09

export const DUST_ENABLED = true
export const DUST_SPAWN_RATE = 80
export const DUST_PARTICLE_SIZE = 7
export const DUST_PARTICLE_COUNT = 8
export const DUST_SPREAD_ANGLE = 45
export const DUST_VELOCITY = 60
export const DUST_LIFETIME = 400
export const DUST_OPACITY = 0.5

export type Phase = 'idle' | 'accelerating' | 'running' | 'decelerating' | 'landing'

type CatAction = { type: 'START_MOVING'; facingLeft: boolean } | { type: 'STOP_MOVING' }

interface CatState {
    isRunning: boolean
    facingLeft: boolean
}

export interface Particle {
    id: number
    x: number
    y: number
    vx: number
    vy: number
    size: number
    opacity: number
    rotation: number
}

export function getVelocityAtProgress(
    progress: number,
    maxSpeed: number,
    accelEnd: number,
    decelStart: number,
): number {
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

interface UseCatMovementOptions {
    catWidth: number
    catHeight: number
    setPosition: (x: number, y: number, rotation?: number) => void
    animateRotation: (angle: number) => Promise<void>
    setFrame: (frame: string) => void
}

export function useCatMovement({
    catWidth,
    catHeight,
    setPosition,
    animateRotation,
    setFrame,
}: UseCatMovementOptions) {
    const positionRef = useRef({ x: 0, y: 0 })
    const isAnimatingRef = useRef(false)
    const phaseRef = useRef<Phase>('idle')
    const animationFrameRef = useRef<number>(0)
    const scrambleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const particleIdRef = useRef(0)

    const [particles, setParticles] = useState<Particle[]>([])
    const [catState, dispatch] = useReducer(catReducer, {
        isRunning: false,
        facingLeft: false,
    })

    const spawnDustParticles = useCallback(
        (
            x: number,
            y: number,
            dirX: number,
            dirY: number,
            facingLeft: boolean,
            rotationAngle: number,
        ) => {
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
                    x:
                        x +
                        catWidth / 2 +
                        rotatedOffsetX * flipMultiplier +
                        (Math.random() - 0.5) * 10,
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
        },
        [catWidth, catHeight],
    )

    const moveToPosition = useCallback(
        async (targetX: number, targetY: number, onArrive?: () => void) => {
            if (isAnimatingRef.current) return

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
            scrambleIntervalRef.current = scrambleInterval

            await animateRotation(angle)

            let runFrame = 0
            const runFrames = [CAT_FRAMES.run1, CAT_FRAMES.run2, CAT_FRAMES.run3]
            let lastRunFrameTime = performance.now()
            let lastDecelFrameTime = performance.now()
            let lastDustTime = performance.now()
            let decelFrame = 0
            const decelFrames = [
                CAT_FRAMES.run3,
                CAT_FRAMES.run2,
                CAT_FRAMES.run1,
                CAT_FRAMES.land1,
            ]

            const startX = currentPos.x
            const startY = currentPos.y
            let currentX = startX
            let currentY = startY
            let lastTime = performance.now()

            const finishMovement = async () => {
                clearInterval(scrambleInterval)
                scrambleIntervalRef.current = null
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

                    setPosition(currentX, currentY)

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
                    setPosition(targetX, targetY)
                    finishMovement()
                }
            }

            animationFrameRef.current = requestAnimationFrame(animateMovement)
        },
        [catWidth, catHeight, spawnDustParticles, setPosition, animateRotation, setFrame],
    )

    const cancelMovement = useCallback(() => {
        if (scrambleIntervalRef.current) {
            clearInterval(scrambleIntervalRef.current)
            scrambleIntervalRef.current = null
        }
        cancelAnimationFrame(animationFrameRef.current)
        setFrame(CAT_FRAMES.idle)
        phaseRef.current = 'idle'
        dispatch({ type: 'STOP_MOVING' })
        isAnimatingRef.current = false
    }, [setFrame])

    const setInitialPosition = useCallback(
        (x: number, y: number) => {
            positionRef.current = { x, y }
            setPosition(x, y, 0)
        },
        [setPosition],
    )

    return useMemo(
        () => ({
            isRunning: catState.isRunning,
            facingLeft: catState.facingLeft,
            particles,
            positionRef,
            phaseRef,
            isAnimatingRef,
            moveToPosition,
            cancelMovement,
            setInitialPosition,
        }),
        [
            catState.isRunning,
            catState.facingLeft,
            particles,
            positionRef,
            phaseRef,
            isAnimatingRef,
            moveToPosition,
            cancelMovement,
            setInitialPosition,
        ],
    )
}
