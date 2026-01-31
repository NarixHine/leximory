import { Main } from '@repo/ui/main'
import { Metadata } from 'next'
import { PaperCard, PaperCardSkeleton } from './components/paper-card'
import { getPublicPapers } from '@repo/supabase/paper'
import moment from 'moment'
import { Suspense } from 'react'
import { Logo } from '@/components/logo'

export const metadata: Metadata = {
    title: '猫谜',
}

export default function Page() {
    return (
        <Main>
            <h1 className='text-4xl mb-6 mt-3 flex items-center gap-2'><Logo className='size-10' />猫谜</h1>
            <section className='grid sm:grid-cols-2 gap-3'>
                <Suspense fallback={new Array(6).fill(0).map((_, idx) => (<PaperCardSkeleton key={idx} />))}>
                    <Content />
                </Suspense>
            </section>
        </Main>
    )
}

async function Content() {
    const papers = await getPublicPapers()
    return (
        <>
            {papers.map(paper => (
                <PaperCard key={paper.id} uid={paper.creator} id={paper.id} title={paper.title} tags={paper.tags} createdAt={moment(paper.created_at).format('ll')} />
            ))}
        </>
    )
}
