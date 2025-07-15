import { Card, extendVariants } from '@heroui/react'

const FlatCard = extendVariants(Card, {
    variants: {
        shadow: {
            none: {
                base: [
                    'shadow-none',
                    'p-2',
                    'border',
                    'border-foreground',
                ],
            },
        },
        background: {
            transparent: {
                base: 'bg-transparent',
                hover: 'bg-transparent',
                active: 'bg-transparent',
            },
            solid: {
                base: 'bg-foreground',
                hover: 'bg-foreground',
                active: 'bg-foreground',
            },
        }
    },
    defaultVariants: {
        shadow: 'none',
        background: 'transparent',
    },
})

export default FlatCard
