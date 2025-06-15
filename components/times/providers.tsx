'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { ReactNode } from 'react'

const queryClient = new QueryClient()

export default function Provider({ children }: { children: ReactNode }) {
    return <NuqsAdapter>
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    </NuqsAdapter>
}
