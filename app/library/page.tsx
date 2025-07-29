import { CommentaryQuotaCard, AudioQuotaCard } from '@/app/library/components/cards'
import GradientCard from '@/app/library/components/cards/card'
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
import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from 'next/cache'
import { Button } from '@heroui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getUserOrThrow } from '@/server/auth/user'
import AdminDashboardLink from './components/dashboard-link'
import UserAvatar from '@/components/avatar'
import { exampleSharedLib } from '@/lib/config'
import LibraryCard from '../marketplace/[page]/components/card'
import { contentFontFamily } from '@/lib/fonts'

export const metadata: Metadata = {
    title: '文库'
}

async function getData(orFilter: OrFilter, userId: string) {
    const data = await listLibsWithFullInfo({ or: orFilter, userId })
    return data
}

export default function Page() {
    return <Main className='flex flex-col max-w-screen-md'>
        <Nav />

        <div className='flex flex-col max-w-screen-sm w-full mx-auto'>
            <H className='text-5xl font-bold text-primary-400 dark:text-default-500'><PiBooksDuotone />文库</H>
            <Spacer y={8} />
            <div className='flex flex-col gap-4'>
                <div className='grid grid-cols-1 min-[460px]:grid-cols-2 justify-center gap-4'>
                    <Suspense fallback={
                        <GradientCard
                            title='本月 AI 注解额度'
                            className={'bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-default-100 dark:to-default-200'}
                        />
                    }>
                        <CommentaryQuotaCard />
                    </Suspense>
                    <Suspense fallback={
                        <GradientCard
                            title='本月 AI 音频额度'
                        />
                    }>
                        <AudioQuotaCard />
                    </Suspense>
                </div>
            </div>
        </div>

        <Spacer y={4} />

        <Suspense fallback={
            <div className='flex flex-col gap-4 max-w-screen-sm w-full mx-auto'>
                <LibrarySkeleton />
                <LibrarySkeleton />
            </div>
        }>
            <UserLibraryList />
        </Suspense>

        <Spacer y={4} />

        <div className='mx-auto'>
            <LibraryAddButton />
        </div>

        <Spacer y={4} />

        <footer className='flex justify-center gap-2'>
            <Button as={Link} href='/about' variant='light' startContent={<PiVideo />}>
                使用教程
            </Button>
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
    const data = await getData(orFilter, userId)
    const archives = await getArchivedLibs({ userId })
    const compactLibs = data.filter(({ lib }) => lib?.shadow || archives.includes(lib!.id))
    const normalLibs = data.filter(({ lib }) => !lib?.shadow && !archives.includes(lib!.id))
    return (
        <div className='flex flex-col gap-4 w-full'>
            <ConfirmUnstarRoot />
            <section className='flex flex-col gap-4 max-w-screen-sm w-full mx-auto'>
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
                            avatar={<UserAvatar uid={exampleSharedLib.owner} />}
                            library={{
                                ...exampleSharedLib,
                                readers: undefined,
                            }}
                            isStarred={false}
                        />
                    </div>
                    <p
                        style={{ fontFamily: contentFontFamily }}
                        className='text-center text-2xl font-bold max-w-60 text-balance text-default-500'>
                        暂无文库，不妨先看看 Leximory 精选外刊
                    </p>
                </div>}
            </section>
            {compactLibs.length > 0 && <section className={cn('w-full flex relative flex-wrap justify-center mb-1 mt-3 md:mt-1 px-2 py-2 border border-dashed border-default-300 rounded-lg md:before:content-["归档↝"] before:content-["归档↴"] before:absolute before:md:top-2 before:md:-left-2 before:md:-translate-x-full before:md:text-medium before:-top-5 before:left-2 before:text-default-400 before:text-sm')}>
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
