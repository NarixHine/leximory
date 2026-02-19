import TextList from './components/text-list'
import { authReadToLib } from '@/server/auth/role'
import { getTexts } from '@/server/db/text'
import { LibProps } from '@/lib/types'
import { Suspense } from 'react'
import { PiArrowLeft, PiBookBookmark } from 'react-icons/pi'
import Link from 'next/link'
import StoneSkeleton from '@/components/ui/stone-skeleton'
import LoadingIndicatorWrapper from '@/components/ui/loading-indicator-wrapper'

async function getData(lib: string) {
    const [{ name, isReadOnly, isOwner, access }, texts] = await Promise.all([
        authReadToLib(lib),
        getTexts({ lib })
    ])
    return { texts, name, isReadOnly, isOwner, access }
}

async function PageContent({ params }: LibProps) {
    const { lib } = await params
    const { texts, name, isReadOnly } = await getData(lib)
    return <>
        {/* Header */}
        <header className='mx-auto mb-10 max-w-6xl'>
            <div className='flex items-center gap-2'>
                <Link
                    href='/library'
                    className='flex h-8 w-8 items-center justify-center rounded-full text-default-400 transition-colors hover:bg-default-100 hover:text-default-600'
                    aria-label='返回文库'
                >
                    <LoadingIndicatorWrapper variant='spinner'>
                        <PiArrowLeft className='size-6' />
                    </LoadingIndicatorWrapper>
                </Link>
                <Link
                    href={`/library/${lib}/corpus`}
                    className='flex h-8 w-8 items-center justify-center rounded-full text-default-400 transition-colors hover:bg-default-100 hover:text-default-600'
                    aria-label='语块本'
                >
                    <LoadingIndicatorWrapper variant='spinner'>
                        <PiBookBookmark className='size-6' />
                    </LoadingIndicatorWrapper>
                </Link>
                <h1 className='font-formal text-2xl tracking-tight text-foreground ml-3'>
                    {name}
                </h1>
            </div>
        </header>

        <TextList texts={texts.map(t => ({ ...t, topics: t.topics ?? [] }))} isReadOnly={isReadOnly} />
    </>
}

function PageSkeleton() {
    return (
        <div className='mx-auto max-w-6xl'>
            <header className='mb-10'>
                <div className='flex items-center gap-3'>
                    <StoneSkeleton className='w-8 h-8 rounded-full' />
                    <StoneSkeleton className='w-48 h-7 rounded-lg' />
                </div>
            </header>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                <StoneSkeleton className='aspect-4/3 rounded-sm' />
                <StoneSkeleton className='aspect-4/3 rounded-sm' />
                <StoneSkeleton className='aspect-4/3 rounded-sm' />
            </div>
        </div>
    )
}

export default async function Page(props: LibProps) {
    return (
        <main className='min-h-screen px-4 py-8 sm:px-6 lg:px-8'>
            <Suspense fallback={<PageSkeleton />}>
                <PageContent params={props.params} />
            </Suspense>
        </main>
    )
}
