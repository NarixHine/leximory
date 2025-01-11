import { HydrationBoundary } from 'jotai-ssr'
import { ReactNode } from 'react'
import { totalPagesAtom } from './atoms'
import { countPublicLibs } from '@/server/db/lib'

export const metadata = {
    title: '文库集市'
}

async function getTotalPages() {
    const total = await countPublicLibs()
    return Math.ceil(total / 12)
}

export default async function MarketplaceLayout({
    children
}: {
    children: ReactNode
}) {
    const totalPages = await getTotalPages()

    return (<HydrationBoundary hydrateAtoms={[
        [totalPagesAtom, totalPages]
    ]}>
        {children}
    </HydrationBoundary>)
}
