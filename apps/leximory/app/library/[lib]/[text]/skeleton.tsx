import { Spinner } from '@heroui/spinner'

/** Pulse placeholder block. */
export function Bone({ className }: { className?: string }) {
    return <div className={`animate-pulse rounded-3xl bg-default-100 ${className ?? ''}`} />
}

/** Skeleton matching the ArticleHero responsive layout. */
export function ArticleSkeleton() {
    return (
        <>
            {/* Mobile skeleton: back → emoji cover → tags → title → content */}
            <div className='flex flex-col md:hidden'>
                <Bone className='w-8 h-8 rounded-full ml-5 mt-2 mb-5' />
                <Bone className='w-full h-64 rounded-none' />
                <div className='flex justify-center gap-2 my-3'>
                    <Bone className='w-16 h-5 rounded-full' />
                    <Bone className='w-16 h-5 rounded-full' />
                </div>
                <div className='flex flex-col gap-3 px-5 sm:w-5/6 mx-auto w-full mt-4'>
                    <Bone className='w-1/2 h-8 mx-auto rounded-lg mt-3 mb-8' />
                    <Bone className='w-full h-5 rounded-lg' />
                    <Bone className='w-full h-5 rounded-lg' />
                    <Bone className='w-5/6 h-5 rounded-lg' />
                    <Bone className='w-full h-5 rounded-lg' />
                    <Bone className='w-2/3 h-5 rounded-lg' />
                </div>
            </div>

            {/* md+ skeleton: side-by-side hero */}
            <div className='hidden md:grid md:grid-cols-[1fr_1fr] md:gap-12 md:min-h-dvh md:items-center md:mb-2'>
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
                <Bone className='w-full h-full rounded-none min-h-[60dvh]' />
            </div>

            <div className='flex justify-center'>
                <Spinner color='default' variant='wave' />
            </div>
        </>
    )
}
