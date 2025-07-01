'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { ReactNode } from 'react'
import { HydrationBoundary } from 'jotai-ssr'
import { isReadOnlyAtom, langAtom } from '@/app/library/[lib]/atoms'
import { isFullScreenAtom } from './atoms'

const queryClient = new QueryClient()

export default function Provider({ children, isFullScreen }: { children: ReactNode, isFullScreen: boolean }) {
    return <NuqsAdapter>
        <QueryClientProvider client={queryClient}>
            <HydrationBoundary hydrateAtoms={[
                [isReadOnlyAtom, true],
                [langAtom, 'en'],
                [isFullScreenAtom, isFullScreen]
            ]}>
                {children}
            </HydrationBoundary>
        </QueryClientProvider>
    </NuqsAdapter>
}
