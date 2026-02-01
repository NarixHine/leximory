import { Main } from '@repo/ui/main'
import { Metadata } from 'next'
import { PaperCard, PaperCardSkeleton } from './components/paper-card'
import { getPublicPapers } from '@repo/supabase/paper'
import moment from 'moment'
import { Suspense } from 'react'
import { Logo } from '@/components/logo'
import { cacheLife, cacheTag } from 'next/cache'

export const metadata: Metadata = {
    title: '猫谜',
}

export default function Page() {
    return (
        <Main>
            <div className='mb-6 mt-3 grid grid-cols-[auto_1fr] items-center gap-x-3'>
                <Logo className='size-13' />
                <h1 className='text-4xl'>猫谜</h1>
                <p className='text-default-700 text-sm col-span-2'>与你一起解开英语之谜</p>
            </div>
            <section className='grid sm:grid-cols-2 gap-3'>
                <Suspense fallback={new Array(6).fill(0).map((_, idx) => (<PaperCardSkeleton key={idx} />))}>
                    <Content />
                </Suspense>
            </section>
        </Main>
    )
}

async function Content() {
    'use cache'
    cacheTag('paper:public')
    cacheLife('minutes')
    const papers = await getPublicPapers()
    return (
        <>
            {papers.map(paper => (
                <PaperCard key={paper.id} uid={paper.creator} id={paper.id} title={paper.title} tags={paper.tags} createdAt={moment(paper.created_at).format('ll')} />
            ))}
        </>
    )
}
