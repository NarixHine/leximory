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
                base: 'bg-transparent border border-foreground/80',
                hover: 'bg-transparent border-foreground/80',
                active: 'bg-transparent',
            },
            solid: {
                base: 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700',
            },
        }
    },
    defaultVariants: {
        shadow: 'none',
        background: 'transparent',
    },
})

export default FlatCard
