'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const CAT_FRAME_ASPECT = 469 / 256

export const CAT_FRAMES = {
    idle: '0% 0%',
    scramble1: '50% 0%',
    scramble2: '100% 0%',
    run1: '0% 50%',
    run2: '50% 50%',
    run3: '100% 50%',
    land1: '0% 100%',
    land2: '50% 100%',
} as const

type CatVariant = 'white' | 'black'
type CatFrame = keyof typeof CAT_FRAMES

interface CatSpriteProps {
    variant?: CatVariant
    frame?: CatFrame
    className?: string
    style?: React.CSSProperties
    facingLeft?: boolean
}

export const CatSprite = forwardRef<HTMLDivElement, CatSpriteProps>(function CatSprite({
    variant = 'white',
    frame = 'idle',
    className,
    style,
    facingLeft = false,
}, ref) {
    return (
        <div
            ref={ref}
            className={cn('pointer-events-none w-full h-full bg-no-repeat', className)}
            style={{
                backgroundImage: `url('${variant === 'black' ? '/assets/cat-night.webp' : '/assets/cat.webp'}')`,
                backgroundSize: '300% 300%',
                backgroundPosition: CAT_FRAMES[frame],
                transform: facingLeft ? 'scaleX(-1)' : undefined,
                ...style,
            }}
        />
    )
})
