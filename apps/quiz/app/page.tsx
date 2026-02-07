import { Main } from '@repo/ui/main'
import { Metadata } from 'next'
import { PaperCard, PaperCardSkeleton } from './components/paper-card'
import { getPublicPapers } from '@repo/supabase/paper'
import moment from 'moment'
import { Suspense } from 'react'
import { Logo } from '@/components/logo'
import { Spacer } from '@heroui/spacer'
import { Skeleton } from '@heroui/skeleton'
import { WorkingPapers } from './components/working-paper'
import { cacheTag } from 'next/cache'

export const metadata: Metadata = {
    title: '猫谜',
}

export default function Page() {
    return (
        <Main>
            <div className='mb-6 mt-3 grid grid-cols-[auto_1fr] items-center gap-x-3'>
                <Logo className='size-13' />
                <h1 className='text-4xl'>猫谜</h1>
                <p className='text-default-700 text-sm col-span-2'>陪你一起解开英语之谜</p>
            </div>
            <div className='flex flex-col gap-3'>
                <Suspense fallback={<>
                    <Skeleton className='h-8 opacity-40 w-1/3 mb-2 rounded-2xl' />
                    <section className='grid sm:grid-cols-2 gap-3'>
                        {(new Array(4).fill(0).map((_, idx) => (<PaperCardSkeleton key={idx} />)))}
                    </section>
                </>}>
                    <Content />
                </Suspense>
            </div>
        </Main>
    )
}

async function Content() {
    'use cache'
    cacheTag('paper:public')
    const papers = await getPublicPapers()
    return (<>
        <WorkingPapers />
        <h2 className='font-formal text-4xl block'>从这些练习开始</h2>
        <section className='grid sm:grid-cols-2 gap-3'>
            {papers.filter(({ is_pinned }) => is_pinned).map(paper => (
                <PaperCard key={paper.id} uid={paper.creator} id={paper.id} title={paper.title} tags={paper.tags} createdAt={moment(paper.created_at).format('ll')} isPinned={paper.is_pinned} />
            ))}
        </section>
        <Spacer y={1} />
        <h2 className='font-formal text-4xl block'>浏览所有</h2>
        <section className='grid sm:grid-cols-2 gap-3'>
            {papers.filter(({ is_pinned }) => !is_pinned).map(paper => (
                <PaperCard key={paper.id} uid={paper.creator} id={paper.id} title={paper.title} tags={paper.tags} createdAt={moment(paper.created_at).format('ll')} isPinned={false} />
            ))}
        </section>
    </>)
}
