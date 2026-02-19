'use client'

import { Card, extendVariants } from '@heroui/react'

const FlatCard = extendVariants(Card, {
    variants: {
        shadow: {
            none: {
                base: [
                    'shadow-none',
                    'p-2',
                ],
            },
        },
        background: {
            transparent: {
                base: 'bg-transparent border-none',
                hover: 'bg-transparent',
                active: 'bg-transparent',
            },
            solid: {
                base: 'bg-default-50 border-none',
            },
        }
    },
    defaultVariants: {
        shadow: 'none',
        background: 'transparent',
    },
})

export default FlatCard
