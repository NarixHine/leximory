import Main from '@/components/ui/main'
import { getTextContent } from '@/server/db/text'
import { LibAndTextProps } from '@/lib/types'
import { getArticleData } from './data'
import { Article } from './article'
import { Suspense } from 'react'
import { ArticleSkeleton } from './skeleton'

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

export default async function Page(props: LibAndTextProps) {
    return (<Main className='max-w-none sm:w-full pt-6 md:pt-0 px-0 md:px-0 [counter-reset:sidenote-counter] md:pb-4'>
        <Suspense fallback={<ArticleSkeleton />}>
            <PageContent params={props.params} />
        </Suspense>
    </Main>)
}
