import Editory from '@/components/editory/panel'
import Main from '@/components/ui/main'
import { getPaper } from '@repo/supabase/paper'
import { ScopeProvider } from '@/components/ui/scope-provider'
import { HydrationBoundary } from 'jotai-ssr'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { CircularProgress } from '@heroui/progress'
import { ToHome } from '../components/to-home'
import { QuizItemsSchema } from '@repo/schema/paper'
import { paperIdAtom, EDITORY_PAPER_ID, editoryItemsAtom, viewModeAtom } from '@repo/ui/paper/atoms'

type PaperPageProps = {
    params: Promise<{
        id: string
    }>
}

export async function generateMetadata({ params }: PaperPageProps): Promise<Metadata> {
    const id = (await params).id
    const paper = await getPaper({ id: parseInt(id) })
    return {
        title: `执笔「${paper.title}」`,
    }
}

export default async function PaperPage({ params }: PaperPageProps) {
    return (<>
        <ToHome />
        <Main className='max-w-none sm:w-full lg:-translate-x-5'>
            <Suspense fallback={<div className='absolute inset-0 flex justify-center items-center'>
                <CircularProgress />
            </div>}>
                <Paper params={params} />
            </Suspense>
        </Main>
    </>
    )
}

async function Paper({ params }: PaperPageProps) {
    const id = (await params).id
    const paper = await getPaper({ id: parseInt(id) })
    const data = QuizItemsSchema.parse(paper.content)
    return (
        <HydrationBoundary hydrateAtoms={[
            [paperIdAtom, EDITORY_PAPER_ID],
            [editoryItemsAtom, data]
        ]}>
            <ScopeProvider atoms={[editoryItemsAtom, viewModeAtom]}>
                <Suspense>
                    <Editory id={id} />
                </Suspense>
            </ScopeProvider>
        </HydrationBoundary>
    )
}
