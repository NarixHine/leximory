'use client'

import { Skeleton, extendVariants } from '@heroui/react'

const StoneSkeleton = extendVariants(Skeleton, {
    variants: {
        color: {
            stone: {
                base: [
                    'bg-default-50/50 dark:bg-stone-800',
                    'before:via-default-200/60 dark:before:via-stone-700/60'
                ],
            }
        }
    },
    defaultVariants: {
        color: 'stone'
    }
})

export default StoneSkeleton
