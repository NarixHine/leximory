import { CommentaryQuotaCard, AudioQuotaCard } from '@/app/library/components/cards'
import GradientCard from '@/app/library/components/cards/card'
import Library, { LibraryAddButton, LibrarySkeleton } from '@/app/library/components/lib'
import Main from '@/components/ui/main'
import Nav from '@/components/nav'
import H from '@/components/ui/h'
import { getAuthOrThrow, isListed } from '@/server/auth/role'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { Skeleton } from "@heroui/skeleton"
import { Spacer } from "@heroui/spacer"
import { Metadata } from 'next'
import { Suspense } from 'react'
import { PiBooksDuotone, PiVideo } from 'react-icons/pi'
import { summarizeLibsWithWords } from '@/server/db/lib'
import { exampleSharedLib } from '@/lib/config'
import { getArchivedLibs } from '@/server/db/lib'
import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from 'next/cache'
import { Button } from '@heroui/button'
import Link from 'next/link'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
    title: '文库'
}

async function getData(listedFilter: Awaited<ReturnType<typeof isListed>>, userId: string) {
    const data = await summarizeLibsWithWords({ filter: listedFilter, userId })
    return data.length > 0 ? data : await summarizeLibsWithWords({ filter: { 'lib.id': exampleSharedLib.id }, userId })
}

async function getOrgs() {
    const { data } = await (await clerkClient()).users.getOrganizationMembershipList({ userId: (await auth()).userId! })
    return data.map(({ organization }) => ({
        id: organization.id,
        name: organization.name
    }))
}

async function UserLibraryList() {
    const { userId } = await getAuthOrThrow()
    const mems = await getOrgs()
    return <LibraryList userId={userId} mems={mems} listedFilter={await isListed()} />
}

async function LibraryList({ userId, mems, listedFilter }: {
    userId: string,
    mems: Awaited<ReturnType<typeof getOrgs>>,
    listedFilter: Awaited<ReturnType<typeof isListed>>
}) {
    'use cache'
    cacheTag('libraries')
    cacheLife('days')
    const data = await getData(listedFilter, userId)
    const archives = await getArchivedLibs({ userId })
    const compactLibs = data.filter(({ lib }) => lib?.shadow || archives.includes(lib!.id))
    const normalLibs = data.filter(({ lib }) => !lib?.shadow && !archives.includes(lib!.id))
    return (
        <div className='flex flex-col gap-4 w-full'>
            <section className='flex flex-col gap-4 max-w-screen-sm w-full mx-auto'>
                {normalLibs.map(({ lib, count, isStarred }) => lib && (
                    <Library
                        price={lib.price}
                        shadow={false}
                        access={lib.access}
                        isStarred={isStarred}
                        id={lib.id}
                        key={lib.id}
                        name={lib.name}
                        lang={lib.lang}
                        lexicon={{ count }}
                        isOwner={lib.owner === userId}
                        orgs={mems.map((mem) => ({
                            name: mem.id,
                            label: mem.name
                        }))}
                        orgId={lib.org}
                        archived={false}
                    />
                ))}
            </section>
            {compactLibs.length > 0 && <section className={cn('w-full flex relative flex-wrap justify-center mb-1 mt-3 md:mt-1 px-2 py-2 border border-dashed border-default-200 rounded-lg', CHINESE_ZCOOL.className, 'md:before:content-["归档↝"] before:content-["归档↴"] before:absolute before:md:top-2 before:md:-left-2 before:md:-translate-x-full before:md:text-medium before:-top-5 before:left-2 before:text-default-400 before:text-sm before:', CHINESE_ZCOOL.className)}>
                {compactLibs.map(({ lib, count, isStarred }) => lib && (
                    <Library
                        price={lib.price}
                        shadow={lib.shadow}
                        access={lib.access}
                        isStarred={isStarred}
                        id={lib.id}
                        key={lib.id}
                        name={lib.name}
                        lang={lib.lang}
                        lexicon={{ count }}
                        isOwner={lib.owner === userId}
                        orgs={[]}
                        orgId={lib.org}
                        archived={archives.includes(lib.id)}
                    />
                ))}
            </section>}
        </div>
    )
}

export default function Page() {
    return <Main className='flex flex-col max-w-screen-md'>
        <Nav />

        <div className='flex flex-col max-w-screen-sm w-full mx-auto'>
            <H className='text-5xl'><PiBooksDuotone />文库</H>
            <Spacer y={8} />
            <div className='flex flex-col gap-4'>
                <div className='grid grid-cols-2 justify-center gap-4'>
                    <Suspense fallback={
                        <GradientCard title='本月 AI 注解额度'>
                            <Skeleton className='w-full h-8' />
                        </GradientCard>
                    }>
                        <CommentaryQuotaCard />
                    </Suspense>
                    <Suspense fallback={
                        <GradientCard title='本月 AI 音频额度'>
                            <Skeleton className='w-full h-8' />
                        </GradientCard>
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

        <footer className='flex justify-center'>
            <Button as={Link} href='/about' variant='light' startContent={<PiVideo />} className={CHINESE_ZCOOL.className}>
                使用教程
            </Button>
        </footer>
    </Main>
}
