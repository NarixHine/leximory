import Library, { ConfirmUnstarRoot, LibraryAddButton, LibrarySkeleton } from '@/app/library/components/lib'
import { isListedFilter, OrFilter } from '@/server/auth/role'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { PiBooksDuotone, PiInfo } from 'react-icons/pi'
import { listLibsWithFullInfo } from '@/server/db/lib'
import { getArchivedLibs } from '@/server/db/lib'
import { cacheTag, cacheLife } from 'next/cache'
import { getUserOrThrow } from '@repo/user'
import Main from '@/components/ui/main'
import AdminDashboardLink from './components/dashboard-link'
import LinkButton from '@/components/ui/link-button'
import LoadingIndicatorWrapper from '@/components/ui/loading-indicator-wrapper'
import ImportUI, { ImportUISkeleton } from './components/import'

export const metadata: Metadata = {
    title: '文库'
}

async function getData(orFilter: OrFilter, userId: string) {
    const data = await listLibsWithFullInfo({ or: orFilter, userId })
    return data
}

export default function Page() {
    return (
        <Main>
            {/* Header */}
            <header className='mb-6 mx-auto w-full px-7 max-w-125 sm:max-w-150'>
                <div className='mb-1 flex items-center gap-2'>
                    <PiBooksDuotone className='h-5 w-5 text-default-500' />
                    <span className='text-xs font-semibold uppercase tracking-widest text-default-400'>
                        My Libraries
                    </span>
                </div>
                <div className='flex items-end'>
                    <h1 className='font-formal text-3xl text-foreground font-bold'>
                        我的文库
                    </h1>
                    <div className='flex-1' />
                    <LinkButton
                        href='/about'
                        radius='full'
                        isIconOnly
                        variant='light'
                        color='default'
                        startContent={<LoadingIndicatorWrapper><PiInfo className='size-5' /></LoadingIndicatorWrapper>}
                    />
                    <LibraryAddButton />
                </div>
            </header>

            {/* Libraries */}
            <Suspense fallback={
                <>
                    <ImportUISkeleton />
                    <section className='w-full max-w-125 sm:max-w-150 mx-auto'>
                        <div className='columns-1 sm:columns-2 sm:gap-4 space-y-4'>
                            <LibrarySkeleton rowCount={4} />
                            <LibrarySkeleton rowCount={1} />
                            <LibrarySkeleton rowCount={2} />
                            <LibrarySkeleton rowCount={2} />
                        </div>
                    </section>
                </>
            }>
                <UserLibraryList />
            </Suspense>

            <Suspense>
                <div className='flex justify-center mt-7'>
                    <AdminDashboardLink />
                </div>
            </Suspense>
        </Main>
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

            {/* Import CTA */}
            <ImportUI libraries={data.map(({ lib }) => ({
                id: lib.id,
                name: lib.name,
                lang: lib.lang,
                shadow: lib.shadow,
                archived: archives.includes(lib.id),
            }))} />

            {/* Active libraries — CSS columns masonry */}
            <section className='w-full max-w-125 sm:max-w-150 mx-auto' aria-label='Your libraries'>
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
                <section className='mt-20 w-full max-w-200' aria-label='Archived libraries'>
                    <div className='flex flex-row items-center mb-4'>
                        <div className='flex-1 h-px bg-secondary-300/70 mr-3' />
                        <h2 className='flex items-center font-bold text-lg tracking-widest text-secondary-400 mx-auto w-108 sm:w-133'>
                            <span>已归档</span>
                            <div className='flex-1 h-px bg-secondary-300/70 ml-3' />
                        </h2>
                        <div className='flex-1 h-px bg-secondary-300/70' />
                    </div>
                    <div className='flex flex-wrap gap-2 lg:mx-auto lg:w-170 lg:pl-15'>
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
