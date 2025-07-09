'use client'

import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { ReactNode } from 'react'
import { HydrationBoundary } from 'jotai-ssr'
import { isReadOnlyAtom, langAtom } from '@/app/library/[lib]/atoms'
import { isFullScreenAtom } from './atoms'

export default function Provider({ children, isFullScreen }: { children: ReactNode, isFullScreen: boolean }) {
    return <NuqsAdapter>
        <HydrationBoundary hydrateAtoms={[
            [isReadOnlyAtom, true],
            [langAtom, 'en'],
            [isFullScreenAtom, isFullScreen]
        ]}>
            {children}
        </HydrationBoundary>
    </NuqsAdapter>
}
