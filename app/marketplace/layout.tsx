import { getXataClient } from '@/lib/xata'
import { HydrationBoundary } from 'jotai-ssr'
import { ReactNode } from 'react'
import { totalPagesAtom } from './atoms'
import { libAccessStatusMap } from '@/lib/config'

export const metadata = {
    title: '文库集市'
}

async function getTotalPages() {
    const xata = getXataClient()
    const total = await xata.db.libraries.filter({ access: libAccessStatusMap.public }).summarize({
        summaries: {
            count: { count: '*' }
        }
    })
    return Math.ceil((total.summaries[0]?.count || 0) / 12)
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
