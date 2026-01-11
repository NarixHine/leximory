'use client'

import { Card as HeroUICard, extendVariants } from '@heroui/react'

const Card = extendVariants(HeroUICard, {
    variants: {
        background: {
            flat: {
                base: 'bg-default-50 dark:bg-stone-900 print:border-1 print:border-default',
            },
            transparent: {
                base: 'bg-transparent border-none',
            }
        }
    },
    defaultVariants: {
        shadow: 'none',
        background: 'flat',
    },
})

export default Card
