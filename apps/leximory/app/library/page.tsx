import Library, { ConfirmUnstarRoot, LibraryAddButton, LibrarySkeleton } from '@/app/library/components/lib'
import { isListedFilter, OrFilter } from '@/server/auth/role'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { PiBooksDuotone } from 'react-icons/pi'
import { listLibsWithFullInfo } from '@/server/db/lib'
import { getArchivedLibs } from '@/server/db/lib'
import { cacheTag, cacheLife } from 'next/cache'
import { getUserOrThrow } from '@repo/user'

export const metadata: Metadata = {
    title: '文库'
}

async function getData(orFilter: OrFilter, userId: string) {
    const data = await listLibsWithFullInfo({ or: orFilter, userId })
    return data
}

export default function Page() {
    return (
        <main className='flex min-h-screen flex-col items-center px-4 py-12 sm:py-16'>
            {/* Header */}
            <header className='mb-10 mx-auto w-full max-w-[430px] sm:max-w-[530px]'>
                <div className='mb-1 flex items-center gap-2.5'>
                    <PiBooksDuotone className='h-5 w-5 text-default-500' />
                    <span className='text-xs font-semibold uppercase tracking-widest text-default-400'>
                        Lingua
                    </span>
                </div>
                <div className='flex items-end justify-between'>
                    <h1 className='font-formal text-3xl tracking-tight text-foreground'>
                        文库
                    </h1>
                    <LibraryAddButton />
                </div>
            </header>

            {/* Libraries */}
            <Suspense fallback={
                <section className='w-full max-w-[500px] sm:max-w-[600px]'>
                    <div className='columns-1 sm:columns-2 sm:gap-4 space-y-4'>
                        <LibrarySkeleton />
                        <LibrarySkeleton />
                        <LibrarySkeleton />
                    </div>
                </section>
            }>
                <UserLibraryList />
            </Suspense>
        </main>
    )
}

async function UserLibraryList() {
    const { userId } = await getUserOrThrow()
    return <LibraryList userId={userId} orFilter={await isListedFilter()} />
}

async function LibraryList({ userId, orFilter }: {
    userId: string,
    orFilter: Awaited<ReturnType<typeof isListedFilter>>
}) {
    'use cache'
    cacheTag('libraries')
    cacheLife('days')
    const [data, archives] = await Promise.all([
        getData(orFilter, userId),
        getArchivedLibs({ userId })
    ])
    const compactLibs = data.filter(({ lib }) => lib.shadow || archives.includes(lib.id)).sort((a, b) => (b.lib.shadow ? 1 : 0) - (a.lib.shadow ? 1 : 0))
    const normalLibs = data.filter(({ lib }) => !lib.shadow && !archives.includes(lib.id))
    return (
        <>
            <ConfirmUnstarRoot />

            {/* Active libraries — CSS columns masonry */}
            <section className='w-full max-w-[500px] sm:max-w-[600px]' aria-label='Your libraries'>
                <div className='columns-1 sm:columns-2 sm:gap-4 space-y-4'>
                    {normalLibs.map(({ lib, isStarred }) => lib && (
                        <Library
                            price={lib.price}
                            shadow={false}
                            access={lib.access}
                            isStarred={isStarred}
                            id={lib.id}
                            key={lib.id}
                            name={lib.name}
                            lang={lib.lang}
                            isOwner={lib.owner === userId}
                            archived={false}
                            prompt={lib.prompt}
                        />
                    ))}
                </div>
            </section>

            {/* Archived section */}
            {compactLibs.length > 0 && (
                <section className='mt-12 w-full max-w-[420px] sm:max-w-[480px]' aria-label='Archived libraries'>
                    <h2 className='mb-4 px-1 text-xs font-semibold uppercase tracking-widest text-default-400'>
                        已归档
                    </h2>
                    <div className='flex flex-wrap gap-2'>
                        {compactLibs.map(({ lib, isStarred }) => lib && (
                            <Library
                                price={lib.price}
                                shadow={lib.shadow}
                                access={lib.access}
                                isStarred={isStarred}
                                id={lib.id}
                                key={lib.id}
                                name={lib.name}
                                lang={lib.lang}
                                isOwner={lib.owner === userId}
                                archived={archives.includes(lib.id)}
                                prompt={lib.prompt}
                            />
                        ))}
                    </div>
                </section>
            )}
        </>
    )
}
