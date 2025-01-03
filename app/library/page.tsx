import { CommentaryQuotaCard, AudioQuotaCard } from '@/components/cards'
import GradientCard from '@/components/cards/card'
import Library from '@/components/library'
import Lookback, { LookbackWrapper } from '@/components/lookback'
import Main from '@/components/main'
import Nav from '@/components/nav'
import Options from '@/components/options'
import H from '@/components/h'
import { authWriteToLib, isListed } from '@/lib/auth'
import { supportedLangs, langMap, welcomeMap, libAccessStatusMap, accessOptions, Lang } from '@/lib/config'
import { randomID } from '@/lib/utils'
import { LibrarySkeleton } from '@/components/library'
import { getXataClient } from '@/lib/xata'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { Card, CardBody } from '@nextui-org/card'
import { Skeleton } from '@nextui-org/skeleton'
import { Spacer } from '@nextui-org/spacer'
import { Metadata } from 'next'
import { revalidatePath } from 'next/cache'
import { Suspense } from 'react'
import { PiBooksDuotone, PiFolderPlusDuotone } from 'react-icons/pi'
import { RedirectToSignIn } from '@clerk/nextjs'
import { RenderingBoundary } from 'jotai-ssr'

export const metadata: Metadata = {
    title: '文库'
}

async function getData() {
    const xata = getXataClient()
    const listed = await isListed()
    const data = await xata.db.lexicon.filter(listed).summarize({
        columns: ['lib'],
        summaries: {
            count: { count: '*' },
        },
    })
    if (data.summaries.length === 0) {
        return await xata.db.lexicon.filter({ 'lib.id': '3e4f1126' }).summarize({
            columns: ['lib'],
            summaries: {
                count: { count: '*' },
            },
        })
    }
    return data
}

async function getOrgs() {
    const { data } = await (await clerkClient()).users.getOrganizationMembershipList({ userId: (await auth()).userId! })
    return data
}

async function LibraryList({ userId, save, del, mems }: {
    userId: string
    save: (id: string, form: FormData) => Promise<void>
    del: (id: string) => Promise<void>
    mems: Awaited<ReturnType<typeof getOrgs>>
}) {
    const { summaries } = await getData()
    return (
        <>
            {summaries.map(({ lib, count }) => lib && (
                <Library
                    shortcut={lib.shortcut}
                    del={del.bind(null, lib.id)}
                    save={save.bind(null, lib.id)}
                    access={lib.access}
                    id={lib.id}
                    key={lib.name}
                    name={lib.name}
                    lang={lib.lang}
                    lexicon={{ count }}
                    isOwner={lib.owner === userId}
                    orgs={mems.map((mem) => ({
                        name: mem.organization.id,
                        label: mem.organization.name
                    }))}
                    orgId={lib.org}
                />
            ))}
        </>
    )
}

export default async function Page() {
    const { userId, orgId } = await auth()
    if (!userId) {
        return <RedirectToSignIn />
    }
    const mems = await getOrgs()
    const save = async (id: string, form: FormData) => {
        'use server'
        const xata = getXataClient()
        const lang = form.get('lang') as Lang | undefined
        const access = form.get('access') as keyof typeof libAccessStatusMap
        if (lang) {
            const lib = await xata.db.libraries.create({
                id,
                owner: userId as string,
                name: form.get('name') as string,
                lang: lang as string,
                access: libAccessStatusMap[access],
                org: orgId,
            })
            await xata.db.lexicon.create({
                lib,
                word: welcomeMap[lang],
            })
        }
        else {
            await authWriteToLib(id)
            const org = form.get('org')
            await xata.db.libraries.update(id, typeof org === 'string'
                ? {
                    org: org === 'none' ? null : org,
                    shortcut: form.get('shortcut') === 'true',
                    name: form.get('name') as string,
                    access: libAccessStatusMap[access],
                } : {
                    name: form.get('name') as string,
                    access: libAccessStatusMap[access],
                })
        }
        revalidatePath('/library')
    }
    const del = async (id: string) => {
        'use server'
        const xata = getXataClient()
        await authWriteToLib(id)
        const [texts, words, audios] = await Promise.all([
            xata.db.texts.filter({ lib: id }).getAll(),
            xata.db.lexicon.filter({ lib: id }).getAll(),
            xata.db.audio.filter({ lib: id }).getAll(),
        ])
        await xata.transactions.run([
            { delete: { id, table: 'libraries' } },
            ...texts.map(({ id }) => ({
                delete: {
                    id,
                    table: 'texts' as 'texts'
                }
            })),
            ...words.map(({ id }) => ({
                delete: {
                    id,
                    table: 'lexicon' as 'lexicon'
                }
            })),
            ...audios.map(({ id }) => ({
                delete: {
                    id,
                    table: 'audio' as 'audio'
                }
            })),
        ])
        revalidatePath('/library')
    }

    return <RenderingBoundary>
        <Main className='flex flex-col max-w-screen-sm'>
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

                <div className='w-full my-6'>
                    <Suspense fallback={
                        <LookbackWrapper>
                            <Skeleton className='w-full h-4 rounded-lg mb-3 mt-2' />
                        </LookbackWrapper>
                    }>
                        <Lookback />
                    </Suspense>
                </div>

                <Suspense fallback={
                    <div className='flex flex-col gap-4'>
                        <LibrarySkeleton />
                        <LibrarySkeleton />
                    </div>
                }>
                    <LibraryList
                        userId={userId}
                        save={save}
                        del={del}
                        mems={mems}
                    />
                </Suspense>

                <Options
                    trigger={<Card className='h-full w-full opacity-70 bg-transparent' shadow='none' isPressable>
                        <CardBody className='justify-center items-center flex'>
                            <span className='text-7xl text-slate-700 dark:text-slate-200'><PiFolderPlusDuotone /></span>
                        </CardBody>
                    </Card>}
                    action={save.bind(null, randomID())}
                    inputs={[{
                        name: 'name',
                        label: '文库名',
                    }]}
                    selects={[{
                        name: 'access',
                        label: '权限',
                        value: 'private',
                        options: accessOptions
                    }, {
                        name: 'lang',
                        label: '语言',
                        value: 'en',
                        options: supportedLangs.map(lang => ({
                            name: lang,
                            label: langMap[lang]
                        })),
                    }]}
                />
            </div>
        </Main>
    </RenderingBoundary>
}
