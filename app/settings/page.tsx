import { Metadata } from 'next'
import { getAuthOrThrow } from '@/server/auth/role'
import { WordChartSkeleton } from '@/components/stats/word-chart'
import H from '@/components/ui/h'
import { Avatar } from '@heroui/avatar'
import { Chip } from '@heroui/chip'
import { PiCalendarBlankDuotone, PiCoinsDuotone, PiDotsThreeVerticalBold, PiNotebookDuotone, PiPlanetDuotone } from 'react-icons/pi'
import moment from 'moment'
import { summarizeLibsWithWords } from '@/server/db/lib'
import { clerkClient } from '@clerk/nextjs/server'
import { getPlan } from '@/server/auth/quota'
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
import { getLexicoinBalance, getLastDailyClaim } from '@/server/db/lexicoin'
import GradientCard from '../library/components/cards/card'
import { planMap } from '@/lib/config'
import { ClaimDailyLexicoin } from './components/claim-daily-lexicoin'

export const metadata: Metadata = { title: '设置' }

async function TotalWordsLearned() {
    const { userId } = await getAuthOrThrow()
    const data = await summarizeLibsWithWords({ filter: { 'lib.owner': userId } })
    const totalWordsLearned = data.reduce((acc, curr) => acc + curr.count, 0)
    return <Chip color={'primary'} variant='flat'><div className='flex items-center gap-2'><PiNotebookDuotone className='size-4' />学习了 {totalWordsLearned} 个语汇</div></Chip>
}

async function UserSection() {
    const { userId } = await getAuthOrThrow()
    const { username, imageUrl, createdAt } = await (await clerkClient()).users.getUser(userId)
    return <UserSectionContent username={username} imageUrl={imageUrl} createdAt={createdAt} />
}

function UserSectionContent({
    username,
    imageUrl,
    createdAt
}: {
    username: string | null,
    imageUrl: string | null,
    createdAt: number
}) {
    return <section className='flex flex-col sm:flex-row sm:items-center gap-4 p-4'>
        <Avatar src={imageUrl ?? undefined} isBordered color={'primary'} className='!size-16' />
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
}

function UserSectionSkeleton() {
    return <section className='flex flex-col sm:flex-row sm:items-center gap-4 p-4'>
        <Avatar isBordered color={'primary'} className='!size-16' />
        <div className='flex flex-col gap-1'>
            <span className='text-3xl ml-1 font-mono'>@loading...</span>
            <div className='flex gap-3 w-full mt-2'>
                <Chip color={'primary'} variant='flat'><div className='flex items-center gap-2'><PiCalendarBlankDuotone className='size-4' /><Skeleton className='w-5 h-2 opacity-50 rounded-full' /> 加入</div></Chip>
                <Chip color={'primary'} variant='flat'><div className='flex items-center gap-2'><PiNotebookDuotone className='size-4' />学习了 <Skeleton className='w-5 h-2 opacity-50 rounded-full' /> 个语汇</div></Chip>
            </div>
        </div>
    </section>
}

export default async function Settings() {
    return <Main className='flex flex-col gap-4 max-w-screen-sm'>
        <Suspense fallback={<UserSectionSkeleton />}>
            <UserSection />
        </Suspense>
        <section className='flex flex-col gap-4 w-full justify-center items-center'>
            <Suspense fallback={<Skeleton className='w-full h-12 rounded-full' />}>
                <ClaimDailyLexicoinServer />
            </Suspense>
            <div className='grid grid-cols-2 gap-4 w-full'>
                <Suspense fallback={<LexicoinBalanceCard />}>
                    <LexicoinBalance />
                </Suspense>
                <Suspense fallback={<PlanCard />}>
                    <Plan />
                </Suspense>
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
                <Suspense fallback={<Skeleton className='w-full h-8 rounded-full' />}>
                    <Preference />
                </Suspense>
            </div>
            <div className='border border-dashed border-default-200 rounded-lg p-4 flex flex-col gap-2'>
                <H disableCenter className=''>通行密钥</H>
                <ClerkLoaded>
                    <CopyToken />
                </ClerkLoaded>
            </div>
        </section>
        <div className='h-80 w-full pr-6 pl-0 py-3'>
            <Suspense fallback={<WordChartSkeleton />}>
                <UserWordStats />
            </Suspense>
        </div>
    </Main>
}

async function UserWordStats() {
    const { userId } = await getAuthOrThrow()
    return <WordStats uid={userId} />
}

function LexicoinBalanceCard({ text }: { text?: string }) {
    return <GradientCard title='LexiCoin 余额' text={text} className='bg-gradient-to-tl from-teal-100/80 to-lime-100/80 dark:from-gray-900 dark:to-gray-600'>
        <PiCoinsDuotone className='size-7' />
    </GradientCard>
}

async function LexicoinBalance() {
    const { userId } = await getAuthOrThrow()
    const balance = await getLexicoinBalance(userId)
    return <LexicoinBalanceCard text={`${balance}`} />
}

function PlanCard({ text }: { text?: string }) {
    return <GradientCard title='订阅计划' text={text} className='bg-gradient-to-tl from-rose-100/80 to-teal-100/80 dark:from-gray-900 dark:to-gray-600'>
        <PiPlanetDuotone className='size-7' />
    </GradientCard>
}

async function Plan() {
    const plan = await getPlan()
    return <PlanCard text={planMap[plan]} />
}

async function ClaimDailyLexicoinServer() {
    const { userId } = await getAuthOrThrow()
    const lastClaimDate = await getLastDailyClaim(userId)
    return <ClaimDailyLexicoin hasClaimed={lastClaimDate ? moment(lastClaimDate).isAfter(moment().subtract(1, 'day')) : false} />
}
