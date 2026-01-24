import { EDITORY_PAPER_ID, editoryItemsAtom, paperIdAtom, viewModeAtom } from '@/components/editory/atoms'
import Editory from '@/components/editory/panel'
import Main from '@/components/ui/main'
import { ScopeProvider } from '@/components/ui/scope-provider'
import { HydrationBoundary } from 'jotai-ssr'
import { Metadata } from 'next'
import { Suspense } from 'react'

export const metadata: Metadata = {
    title: 'Editor | PouncePen',
}

export default function Page() {
    return (
        <Main className='max-w-none sm:w-full lg:-translate-x-5'>
            <HydrationBoundary hydrateAtoms={[
                [paperIdAtom, EDITORY_PAPER_ID],
            ]}>
                <ScopeProvider atoms={[editoryItemsAtom, viewModeAtom]}>
                    <Suspense>
                        <Editory />
                    </Suspense>
                </ScopeProvider>
            </HydrationBoundary>
        </Main>
    )
}
