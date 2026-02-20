import Main from '@/components/ui/main'
import { getTextContent } from '@/server/db/text'
import { LibAndTextProps } from '@/lib/types'
import { getArticleData } from './data'
import { Article } from './article'
import { Suspense } from 'react'

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

/** Pulse placeholder block. */
function Bone({ className }: { className?: string }) {
    return <div className={`animate-pulse rounded-3xl bg-default-100 ${className ?? ''}`} />
}

/** Skeleton matching the ArticleHero responsive layout. */
function PageSkeleton() {
    return (
        <>
            {/* Mobile skeleton: back → emoji cover → tags → title → content */}
            <div className='flex flex-col md:hidden'>
                <Bone className='w-8 h-8 rounded-full ml-5 mt-8 mb-5' />
                <Bone className='w-full h-64 rounded-none' />
                <div className='flex justify-center gap-2 my-3'>
                    <Bone className='w-16 h-5 rounded-full' />
                    <Bone className='w-16 h-5 rounded-full' />
                </div>
                <div className='flex flex-col gap-3 px-5 sm:w-5/6 mx-auto w-full mt-4'>
                    <Bone className='w-3/4 h-8 rounded-lg' />
                    <Bone className='w-full h-5 rounded-lg' />
                    <Bone className='w-full h-5 rounded-lg' />
                    <Bone className='w-5/6 h-5 rounded-lg' />
                    <Bone className='w-full h-5 rounded-lg' />
                    <Bone className='w-2/3 h-5 rounded-lg' />
                </div>
            </div>

            {/* md+ skeleton: side-by-side hero */}
            <div className='hidden md:grid md:grid-cols-[1fr_1fr] md:gap-12 md:min-h-dvh md:items-center md:mb-12'>
                <div className='flex flex-col max-w-[calc(40dvw)] self-end justify-self-start pb-15 pl-10'>
                    <Bone className='w-8 h-8 rounded-full mb-5' />
                    <Bone className='w-32 h-5 rounded-lg mb-4' />
                    <Bone className='w-full h-10 rounded-lg mb-2' />
                    <Bone className='w-3/4 h-10 rounded-lg mb-4' />
                    <Bone className='w-24 h-4 rounded-lg mb-4' />
                    <div className='flex gap-2'>
                        <Bone className='w-16 h-5 rounded-full' />
                        <Bone className='w-16 h-5 rounded-full' />
                        <Bone className='w-16 h-5 rounded-full' />
                    </div>
                </div>
                <Bone className='w-full h-full rounded-2xl min-h-[60dvh]' />
            </div>
        </>
    )
}

export default async function Page(props: LibAndTextProps) {
    return (<Main className='max-w-none sm:w-full pt-3 md:pt-0 px-0 md:px-0 [counter-reset:sidenote-counter] md:pb-4'>
        <Suspense fallback={<PageSkeleton />}>
            <PageContent params={props.params} />
        </Suspense>
    </Main>)
}
