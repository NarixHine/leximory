import { HydrationBoundary } from 'jotai-ssr'
import { ReactNode, Suspense } from 'react'
import { totalPagesAtom } from './atoms'
import { countPublicLibs } from '@/server/db/lib'
import { MARKETPLACE_PAGE_SIZE } from '@repo/env/config'

export const metadata = {
    title: '文库集市'
}

async function getTotalPages() {
    const total = await countPublicLibs()
    return Math.ceil(total / MARKETPLACE_PAGE_SIZE)
}

async function TotalPagesHydrator({
    children
}: {
    children: ReactNode
}) {
    const totalPages = await getTotalPages()

    return (
        <HydrationBoundary hydrateAtoms={[
            [totalPagesAtom, totalPages]
        ]}>
            {children}
        </HydrationBoundary>
    )
}

export default function MarketplaceLayout({
    children
}: {
    children: ReactNode
}) {
    return (
        <Suspense>
            <TotalPagesHydrator>{children}</TotalPagesHydrator>
        </Suspense>
    )
}
