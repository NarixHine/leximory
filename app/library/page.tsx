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
import { unstable_cacheTag as cacheTag } from 'next/cache'
import { Button } from '@heroui/button'
import Link from 'next/link'
import { CHINESE_ZCOOL } from '@/lib/fonts'

export const metadata: Metadata = {
    title: '文库'
}

async function getData(listedFilter: Awaited<ReturnType<typeof isListed>>) {
    const data = await summarizeLibsWithWords({ filter: listedFilter })
    return data.length > 0 ? data : await summarizeLibsWithWords({ filter: { 'lib.id': exampleSharedLib.id } })
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
    const data = await getData(listedFilter)
    const archives = await getArchivedLibs({ userId })
    const compactLibs = data.filter(({ lib }) => lib?.shadow || archives.includes(lib!.id))
    const normalLibs = data.filter(({ lib }) => !lib?.shadow && !archives.includes(lib!.id))
    return (
        <div className='flex flex-col gap-4'>
            <section className='flex flex-col gap-4'>
                {normalLibs.map(({ lib, count }) => lib && (
                    <Library
                        price={lib.price}
                        shadow={false}
                        access={lib.access}
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
            {compactLibs.length > 0 && <section className='flex flex-wrap justify-center my-1 px-2 py-2 border border-dashed border-default-200 rounded-lg'>
                {compactLibs.map(({ lib, count }) => lib && (
                    <Library
                        price={lib.price}
                        shadow={lib.shadow}
                        access={lib.access}
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
    return <Main className='flex flex-col max-w-screen-sm'>
        <Nav />
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

            <Suspense fallback={
                <div className='flex flex-col gap-4'>
                    <LibrarySkeleton />
                    <LibrarySkeleton />
                </div>
            }>
                <UserLibraryList />
            </Suspense>

            <LibraryAddButton />

            <footer className='flex justify-center p-1'>
                    <Button as={Link} href='/about' variant='light' startContent={<PiVideo />} className={CHINESE_ZCOOL.className}>
                        使用教程
                    </Button>
            </footer>
        </div>
    </Main>
}
