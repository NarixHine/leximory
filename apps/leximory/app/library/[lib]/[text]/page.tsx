import Main from '@/components/ui/main'
import { getTextContent } from '@/server/db/text'
import { LibAndTextProps } from '@/lib/types'
import { getArticleData } from './data'
import { Article } from './article'
import { Suspense } from 'react'
import StoneSkeleton from '@/components/ui/stone-skeleton'

export async function generateMetadata(props: LibAndTextProps) {
    const params = await props.params
    const { title } = await getTextContent({ id: params.text })
    return {
        title: typeof title === 'string' && title !== '' ? title : '新文本'
    }
}

async function PageContent({ params }: LibAndTextProps) {
    const { text } = await params
    const data = await getArticleData(text)
    return <Article {...data} text={text} />
}

function PageSkeleton() {
    return (
        <div className='flex flex-col gap-6 pt-8'>
            <StoneSkeleton className='w-8 h-8 rounded-full' />
            <StoneSkeleton className='aspect-square w-full max-w-xs rounded-2xl' />
            <StoneSkeleton className='w-3/4 h-10 rounded-lg' />
            <StoneSkeleton className='w-1/3 h-4 rounded-lg' />
        </div>
    )
}

export default async function Page(props: LibAndTextProps) {
    return (<Main className='max-w-(--breakpoint-lg) [counter-reset:sidenote-counter] md:pb-4'>
        <Suspense fallback={<PageSkeleton />}>
            <PageContent params={props.params} />
        </Suspense>
    </Main>)
}
