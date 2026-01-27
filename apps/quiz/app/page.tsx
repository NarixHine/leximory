import { Main } from '@repo/ui/main'
import { Metadata } from 'next'
import { PaperCard } from './components/paper-card'
import { getPublicPapers } from '@repo/supabase/paper'
import moment from 'moment'

export const metadata: Metadata = {
    title: '猫谜',
}

export default async function Page() {
    const papers = await getPublicPapers()
    return (
        <Main>
            <section className='grid grid-cols-2 gap-3'>
                {papers.map(paper => (
                    <PaperCard key={paper.id} uid={paper.creator} id={paper.id} title={paper.title} tags={paper.tags} createdAt={moment(paper.created_at).format('ll')} />
                ))}
            </section>
        </Main>
    )
}
