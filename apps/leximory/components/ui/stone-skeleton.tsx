'use client'

import { Skeleton, extendVariants } from '@heroui/react'

const StoneSkeleton = extendVariants(Skeleton, {
    variants: {
        color: {
            stone: {
                base: [
                    'bg-default-100/50',
                    'before:via-default-200/60'
                ],
            }
        }
    },
    defaultVariants: {
        color: 'stone'
    }
})

export default StoneSkeleton
