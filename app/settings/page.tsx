import { Metadata } from 'next'
import { getAuthOrThrow } from '@/server/auth/role'
import { HydrationBoundary } from 'jotai-ssr'
import { accentAtom } from './atoms'
import { getPreference } from './actions'
import { WordChartSkeleton } from '@/components/stats/word-chart'
import H from '@/components/ui/h'
import { Avatar } from '@heroui/avatar'
import { Chip } from '@heroui/chip'
import { PiCalendarBlankDuotone, PiDotsThreeVerticalBold, PiNotebookDuotone } from 'react-icons/pi'
import moment from 'moment'
import { summarizeLibsWithWords } from '@/server/db/lib'
import { clerkClient } from '@clerk/nextjs/server'
import WordStats from '@/components/stats'
import { Suspense } from 'react'
import Main from '@/components/ui/main'
import Preference from './components/preference'
import { ClerkLoaded, OrganizationSwitcher } from '@clerk/nextjs'
import CopyToken, { CopyProfileLink } from './components/copy'
import { Button } from '@heroui/button'
import Link from 'next/link'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { Skeleton } from '@heroui/skeleton'

export const metadata: Metadata = { title: '设置' }

async function TotalWordsLearned() {
    const { userId } = await getAuthOrThrow()
    const data = await summarizeLibsWithWords({ filter: { 'lib.owner': userId } })
    const totalWordsLearned = data.reduce((acc, curr) => acc + curr.count, 0)
    return <Chip color={'primary'} variant='flat'><div className='flex items-center gap-2'><PiNotebookDuotone className='size-4' />学习了 {totalWordsLearned} 个语汇</div></Chip>
}

export default async function Settings() {
    const { userId } = await getAuthOrThrow()
    const accent = await getPreference()
    const { username, imageUrl, createdAt } = await (await clerkClient()).users.getUser(userId)

    return <HydrationBoundary hydrateAtoms={[
        [accentAtom, accent]
    ]}>
        <Main className='flex flex-col gap-4 max-w-screen-sm'>
            <section className='flex flex-col sm:flex-row sm:items-center gap-4 p-4'>
                <Avatar src={imageUrl} isBordered color={'primary'} className='!size-16' />
                <div className='flex flex-col gap-1'>
                    <span className='text-3xl ml-1 font-mono'>{username ? `@${username}` : 'Hi.'}</span>
                    <div className='flex gap-3 w-full mt-2'>
                        <Chip color={'primary'} variant='flat'><div className='flex items-center gap-2'><PiCalendarBlankDuotone className='size-4' />{moment(createdAt).calendar()} 加入</div></Chip>
                        <Suspense fallback={<Chip color={'primary'} variant='flat'><div className='flex items-center gap-2'><PiNotebookDuotone className='size-4' />学习了 <Skeleton className='w-5 h-2 opacity-50 rounded-full' /> 个语汇</div></Chip>}>
                            <TotalWordsLearned />
                        </Suspense>
                    </div>
                </div>
            </section>
            <section className='grid grid-cols-2 gap-4'>
                <div className='border col-span-2 border-dashed border-primary-200 rounded-lg p-4 flex flex-col gap-2'>
                    <H disableCenter className=''>账号管理</H>
                    <div className='flex gap-2'>
                        <OrganizationSwitcher />
                        <Button variant='bordered' href='/settings/account' as={Link} startContent={<PiDotsThreeVerticalBold className='size-4 -mr-1' />} size='sm' color='primary' radius='full' className={cn('border-1', CHINESE_ZCOOL.className)}>更多</Button>
                        <CopyProfileLink />
                    </div>
                </div>
                <div className='border border-dashed border-secondary-200 rounded-lg p-4 flex flex-col gap-2'>
                    <H disableCenter className=''>英语偏好</H>
                    <Preference />
                </div>
                <div className='border border-dashed border-default-200 rounded-lg p-4 flex flex-col gap-2'>
                    <H disableCenter className=''>通行密钥</H>
                    <ClerkLoaded>
                        <CopyToken />
                    </ClerkLoaded>
                </div>
            </section>
            <div className='h-72 w-full pr-6 pl-0 pt-3'>
                <Suspense fallback={<WordChartSkeleton />}>
                    <WordStats uid={userId} />
                </Suspense>
            </div>
        </Main>
    </HydrationBoundary>
}
