import TextList from './components/text-list'
import { authReadToLib } from '@/server/auth/role'
import { getTexts } from '@/server/db/text'
import { LibProps } from '@/lib/types'
import { Suspense } from 'react'
import { PiArrowLeft, PiBookBookmark, PiPrinter } from 'react-icons/pi'
import Link from 'next/link'
import LoadingIndicatorWrapper from '@/components/ui/loading-indicator-wrapper'
import Main from '@/components/ui/main'

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
            <div className='flex items-center gap-2 flex-wrap'>
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
                <Link
                    href={`/library/${lib}/print`}
                    className='flex h-8 w-8 items-center justify-center rounded-full text-default-400 transition-colors hover:bg-default-100 hover:text-default-600'
                    aria-label='打印全部'
                >
                    <LoadingIndicatorWrapper variant='spinner'>
                        <PiPrinter className='size-6' />
                    </LoadingIndicatorWrapper>
                </Link>
                <h1 className='font-formal text-balance text-2xl tracking-tight ml-1 text-default-600'>
                    {name}
                </h1>
            </div>
        </header>

        <TextList texts={texts.map(t => ({ ...t, topics: t.topics ?? [] }))} isReadOnly={isReadOnly} />
    </>
}

/** Pulse placeholder block. */
function Bone({ className }: { className?: string }) {
    return <div className={`animate-pulse rounded-3xl bg-default-100 ${className ?? ''}`} />
}

/** Skeleton matching the TextList responsive layout. */
function PageSkeleton() {
    return (
        <>
            {/* Header skeleton */}
            <header className='mx-auto mb-10 max-w-6xl'>
                <div className='flex items-center gap-3'>
                    <Bone className='w-8 h-8 rounded-full' /> {/* Back button */}
                    <Bone className='w-8 h-8 rounded-full' /> {/* Corpus link */}
                    <Bone className='w-48 h-7 rounded-lg ml-3' /> {/* Library name */}
                </div>
            </header>

            {/* Mobile: single column */}
            <div className='mx-auto max-w-md md:hidden flex flex-col gap-8'>
                <Bone className='aspect-2/1 w-full' />
                {[1, 2, 3].map(i => (
                    <div key={i}>
                        <Bone className='aspect-4/3 w-full mb-3' />
                        <Bone className='w-3/4 h-6 rounded-lg mb-2' />
                        <Bone className='w-1/3 h-4 rounded-full' />
                    </div>
                ))}
            </div>

            {/* Tablet: 2-column */}
            <div className='mx-auto hidden max-w-4xl md:block lg:hidden'>
                <div className='grid grid-cols-[1.2fr_1fr] gap-8'>
                    <div>
                        <Bone className='aspect-4/3 w-full mb-3' />
                        <Bone className='w-3/4 h-8 rounded-lg mx-auto mb-3' />
                        <Bone className='w-1/3 h-4 rounded-full mx-auto' />
                    </div>
                    <div className='flex flex-col gap-6'>
                        {[1, 2, 3].map(i => (
                            <div key={i} className='flex gap-4'>
                                <div className='flex-1 flex flex-col justify-center gap-2'>
                                    <Bone className='w-full h-4 rounded-lg' />
                                    <Bone className='w-2/3 h-4 rounded-lg' />
                                    <Bone className='w-1/3 h-3 rounded-full' />
                                </div>
                                <Bone className='h-22 w-22 shrink-0' />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Desktop: 3-column Atlantic grid */}
            <div className='mx-auto hidden max-w-6xl lg:block'>
                <div className='grid grid-cols-[3fr_6fr_4fr] gap-8 xl:gap-10'>
                    {/* Left column */}
                    <div className='flex flex-col gap-10'>
                        {[1, 2].map(i => (
                            <div key={i}>
                                <Bone className='aspect-4/3 w-full mb-3' />
                                <Bone className='w-3/4 h-5 rounded-lg mb-2' />
                                <Bone className='w-1/3 h-3 rounded-full' />
                            </div>
                        ))}
                    </div>
                    {/* Center column */}
                    <div className='border-default-200/80 border-x px-8 xl:px-10'>
                        <Bone className='aspect-4/3 w-full mb-8' />
                        <Bone className='w-3/4 h-10 rounded-lg mx-auto mb-3' />
                        <Bone className='w-1/3 h-5 rounded-lg mx-auto mb-4' />
                        <Bone className='w-1/4 h-4 rounded-full mx-auto' />
                    </div>
                    {/* Right column */}
                    <div className='flex flex-col gap-6'>
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className='flex gap-4'>
                                <div className='flex-1 flex flex-col justify-center gap-2'>
                                    <Bone className='w-full h-4 rounded-lg' />
                                    <Bone className='w-2/3 h-4 rounded-lg' />
                                    <Bone className='w-1/3 h-3 rounded-full' />
                                </div>
                                <Bone className='h-22 w-22 shrink-0' />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
}

export default async function Page(props: LibProps) {
    return (
        <Main className='max-w-none md:w-11/12'>
            <Suspense fallback={<PageSkeleton />}>
                <PageContent params={props.params} />
            </Suspense>
        </Main>
    )
}
