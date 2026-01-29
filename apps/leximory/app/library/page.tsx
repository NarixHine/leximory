import { CommentaryQuotaUI, AudioQuotaUI } from '@/app/library/components/cards'
import Library, { ConfirmUnstarRoot, LibraryAddButton, LibrarySkeleton } from '@/app/library/components/lib'
import Main from '@/components/ui/main'
import Nav from '@/components/nav'
import H from '@/components/ui/h'
import { isListedFilter, OrFilter } from '@/server/auth/role'
import { Spacer } from "@heroui/spacer"
import { Metadata } from 'next'
import { Suspense } from 'react'
import { PiBooksDuotone, PiVideo } from 'react-icons/pi'
import { listLibsWithFullInfo } from '@/server/db/lib'
import { getArchivedLibs } from '@/server/db/lib'
import { cacheTag, cacheLife } from 'next/cache'
import { cn } from '@/lib/utils'
import { getUserOrThrow } from '@repo/user'
import AdminDashboardLink from './components/dashboard-link'
import UserAvatar from '@repo/ui/avatar'
import { EXAMPLE_SHARED_LIB } from '@repo/env/config'
import LibraryCard from '../marketplace/[page]/components/card'
import Streak from '@/components/streak'
import LinkButton from '@repo/ui/link-button'

export const metadata: Metadata = {
    title: '文库'
}

async function getData(orFilter: OrFilter, userId: string) {
    const data = await listLibsWithFullInfo({ or: orFilter, userId })
    return data
}

export default function Page() {
    return <Main className='flex flex-col max-w-(--breakpoint-lg) md:pb-4 pb-20'>
        <Nav />

        <div className='flex flex-col max-w-(--breakpoint-sm) w-full mx-auto'>
            <H className='text-5xl font-bold text-primary-400 dark:text-default-500'><PiBooksDuotone />文库</H>
            <Spacer y={8} />
            <div className='flex flex-col gap-4'>
                <div className='grid grid-cols-1 min-[460px]:grid-cols-2 justify-center gap-4'>
                    <Suspense fallback={<CommentaryQuotaUI.Skeleton />}>
                        <CommentaryQuotaUI.Card />
                    </Suspense>
                    <Suspense fallback={<AudioQuotaUI.Skeleton />}>
                        <AudioQuotaUI.Card />
                    </Suspense>
                </div>
                <Streak compact />
            </div>
        </div>

        <Spacer y={4} />

        <Suspense fallback={
            <div className='flex flex-col gap-4 max-w-(--breakpoint-sm) w-full mx-auto'>
                <LibrarySkeleton />
                <LibrarySkeleton />
            </div>
        }>
            <UserLibraryList />
        </Suspense>

        <Spacer y={2} />

        <div className='mx-auto mt-auto'>
            <LibraryAddButton />
        </div>

        <Spacer y={2} />

        <footer className='flex justify-center gap-2'>
            <LinkButton href='/about' variant='light' startContent={<PiVideo />}>
                使用教程
            </LinkButton>
            <Suspense>
                <AdminDashboardLink />
            </Suspense>
        </footer>
    </Main>
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
        <div className='flex flex-col gap-5 w-full'>
            <ConfirmUnstarRoot />
            <section className='flex flex-col gap-4 max-w-(--breakpoint-sm) w-full mx-auto'>
                {normalLibs.concat(compactLibs).length > 0 ? normalLibs.map(({ lib, isStarred }) => lib && (
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
                )) : <div className='flex flex-col min-[540px]:flex-row items-center gap-4 h-full justify-center'>
                    <div>
                        <LibraryCard
                            isOwner={false}
                            avatar={<UserAvatar uid={EXAMPLE_SHARED_LIB.owner} />}
                            library={{
                                ...EXAMPLE_SHARED_LIB,
                                readers: undefined,
                            }}
                            isStarred={false}
                        />
                    </div>
                    <p
                        className='text-center text-2xl font-bold max-w-60 text-balance text-default-500 font-formal'>
                        暂无文库，不妨先看看 Leximory 精选外刊
                    </p>
                </div>}
            </section>
            {compactLibs.length > 0 && <section className={cn('w-full flex relative flex-wrap justify-center gap-3 px-2 pt-3 rounded-lg')}>
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
            </section>}
        </div>
    )
}
