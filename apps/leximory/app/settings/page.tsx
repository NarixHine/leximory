import { Metadata } from 'next'
import { Avatar } from '@heroui/avatar'
import { PiCalendarBlankDuotone, PiCoinsDuotone, PiPlanetDuotone } from 'react-icons/pi'
import { Suspense } from 'react'
import Main from '@/components/ui/main'
import Preference from './components/preference'
import CopyToken from './components/copy'
import { getLexicoinBalance, getLastDailyClaim } from '@/server/db/lexicoin'
import GradientCard from './components/cards/card'
import { PLAN_LABELS } from '@repo/env/config'
import { ClaimDailyLexicoin } from './components/claim-daily-lexicoin'
import ContinuousNumberFlow from '@/components/ui/continuous-number-flow'
import Upgrade from './components/upgrade'
import { UserWordHeatmap } from '@/components/stats'
import { HeatmapSkeleton } from '@/components/stats/calendar'
import 'moment/locale/zh-cn'
import { getPlan, getUserOrThrow } from '@repo/user'
import UpdateProfile, { UpdateProfileSkeleton } from './components/update-profile'
import { momentSH } from '@/lib/moment'
import Streak from '@/components/streak'
import { CommentaryQuotaUI, AudioQuotaUI } from './components/cards'

export const metadata: Metadata = { title: '设置' }

async function HeroSection() {
    const { username, image, createdAt } = await getUserOrThrow()
    return (
        <section className='flex items-center gap-5 px-2'>
            <Avatar src={image} isBordered color='default' className='size-16! shrink-0' />
            <div className='flex flex-col gap-1 min-w-0'>
                <h1 className='text-2xl font-formal tracking-tight text-foreground truncate'>{username ?? '你好 👋'}</h1>
                <span className='text-xs tracking-wider text-default-500 font-mono flex items-center gap-1.5'>
                    <PiCalendarBlankDuotone className='size-3.5' />
                    {momentSH(createdAt).locale('zh-cn').calendar()} 加入
                </span>
            </div>
        </section>
    )
}

function HeroSectionSkeleton() {
    return (
        <section className='flex items-center gap-5 px-2'>
            <div className='size-16 shrink-0 animate-pulse rounded-full bg-default-100' />
            <div className='flex flex-col gap-2 min-w-0'>
                <div className='h-6 w-32 animate-pulse rounded-full bg-default-100' />
                <div className='h-3 w-24 animate-pulse rounded-full bg-default-100' />
            </div>
        </section>
    )
}

async function UserSection() {
    const { userId, username, image } = await getUserOrThrow()
    return <UpdateProfile userId={userId} username={username} image={image} />
}

async function UpgradeServer() {
    const plan = await getPlan()
    return <Upgrade isOnFreeTier={plan === 'beginner'} />
}

export default async function Settings() {
    return (
        <Main className='flex flex-col gap-3 max-w-(--breakpoint-sm)'>
            {/* Hero — avatar & name */}
            <Suspense fallback={<HeroSectionSkeleton />}>
                <HeroSection />
            </Suspense>

            {/* Actions — upgrade & daily claim */}
            <section className='flex gap-3 w-full'>
                <Suspense fallback={<div className='h-12 w-28 animate-pulse rounded-full bg-default-100' />}>
                    <UpgradeServer />
                </Suspense>
                <Suspense fallback={<div className='h-12 flex-1 animate-pulse rounded-full bg-default-100' />}>
                    <ClaimDailyLexicoinServer />
                </Suspense>
            </section>

            {/* Stats grid */}
            <section className='grid grid-cols-2 gap-3 w-full'>
                <Suspense fallback={<LexicoinBalanceCard />}>
                    <LexicoinBalance />
                </Suspense>
                <Suspense fallback={<PlanCard />}>
                    <Plan />
                </Suspense>
                <Suspense fallback={<CommentaryQuotaUI.Skeleton />}>
                    <CommentaryQuotaUI.Card />
                </Suspense>
                <Suspense fallback={<AudioQuotaUI.Skeleton />}>
                    <AudioQuotaUI.Card />
                </Suspense>
            </section>

            {/* Activity */}
            <section className='flex flex-col gap-3'>
                <Suspense fallback={<HeatmapSkeleton />}>
                    <UserWordHeatmap />
                </Suspense>
            </section>

            {/* Preferences */}
            <section className='grid grid-cols-2 gap-3'>
                <div className='bg-default-50 rounded-2xl p-5 flex flex-col gap-3'>
                    <h2 className='text-sm font-formal tracking-tight text-default-500'>英语偏好</h2>
                    <Suspense fallback={<div className='h-8 w-full animate-pulse rounded-full bg-default-100' />}>
                        <Preference />
                    </Suspense>
                </div>
                <div className='bg-default-50 rounded-2xl p-5 flex flex-col gap-3'>
                    <h2 className='text-sm font-formal tracking-tight text-default-500'>通行密钥</h2>
                    <CopyToken />
                </div>
            </section>

            {/* Account management */}
            <section>
                <Suspense fallback={<UpdateProfileSkeleton />}>
                    <UserSection />
                </Suspense>
            </section>

            <Streak />
        </Main>
    )
}

function LexicoinBalanceCard({ balance }: { balance?: number }) {
    return (
        <GradientCard
            title='LexiCoin 余额'
            text={balance ? <ContinuousNumberFlow value={balance} /> : null}
            className='bg-linear-to-bl from-default-100 to-default-200/60 dark:from-default-100/30 dark:to-default-200/20'
        >
            <PiCoinsDuotone className='size-7' />
        </GradientCard>
    )
}

async function LexicoinBalance() {
    const { userId } = await getUserOrThrow()
    const balance = await getLexicoinBalance(userId)
    return <LexicoinBalanceCard balance={balance} />
}

function PlanCard({ text }: { text?: string }) {
    return (
        <GradientCard
            title='订阅计划'
            text={text}
            className='bg-linear-to-br from-default-200/60 to-default-100 dark:from-default-200/20 dark:to-default-100/30'
        >
            <PiPlanetDuotone className='size-7' />
        </GradientCard>
    )
}

async function Plan() {
    const plan = await getPlan()
    return <PlanCard text={PLAN_LABELS[plan]} />
}

async function ClaimDailyLexicoinServer() {
    const { userId } = await getUserOrThrow()
    const lastClaimDate = await getLastDailyClaim(userId)
    return <ClaimDailyLexicoin hasClaimed={lastClaimDate ? momentSH(lastClaimDate).isSame(momentSH(), 'day') : false} />
}
