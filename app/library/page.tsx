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
import { PiBooksDuotone } from 'react-icons/pi'
import { summarizeLibsWithWords } from '@/server/db/lib'
import { exampleSharedLib } from '@/lib/config'
import { redirect } from 'next/navigation'
import { getMaintenanceStatus } from '@/server/db/config'
import { isProd } from '@/lib/env'
import { getArchivedLibs } from '@/server/db/archive'

export const metadata: Metadata = {
    title: '文库'
}

async function getData() {
    const listed = await isListed()
    const data = await summarizeLibsWithWords({ filter: listed })
    return data.length > 0 ? data : await summarizeLibsWithWords({ filter: { 'lib.id': exampleSharedLib.id } })
}

async function getOrgs() {
    const { data } = await (await clerkClient()).users.getOrganizationMembershipList({ userId: (await auth()).userId! })
    return data
}

async function LibraryList({ mems }: {
    mems: Awaited<ReturnType<typeof getOrgs>>
}) {
    const { userId } = await getAuthOrThrow()
    const data = await getData()
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
                            name: mem.organization.id,
                            label: mem.organization.name
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

export default async function Page() {
    const isMaintenance = await getMaintenanceStatus()
    if (isProd && isMaintenance) {
        redirect('/maintenance')
    }
    const mems = await getOrgs()
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
                <LibraryList mems={mems} />
            </Suspense>

            <LibraryAddButton />
        </div>
    </Main>
}
