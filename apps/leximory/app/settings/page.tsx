import { Metadata } from 'next'
import H from '@/components/ui/h'
import { Avatar } from '@heroui/avatar'
import { Chip } from '@heroui/chip'
import { PiCalendarBlankDuotone, PiCoinsDuotone, PiPlanetDuotone } from 'react-icons/pi'
import { Suspense } from 'react'
import Main from '@/components/ui/main'
import Preference from './components/preference'
import CopyToken from './components/copy'
import { getLexicoinBalance, getLastDailyClaim } from '@/server/db/lexicoin'
import GradientCard from '../library/components/cards/card'
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
import StoneSkeleton from '@/components/ui/stone-skeleton'
import Streak from '@/components/streak'

export const metadata: Metadata = { title: '设置' }

async function HeroSection() {
    const { username, image, createdAt } = await getUserOrThrow()
    return <section className='flex flex-col sm:flex-row sm:items-center gap-4 p-4'>
        <Avatar src={image} isBordered color={'primary'} className='size-16! ml-2 sm:ml-0' />
        <div className='flex flex-col gap-2'>
            <span className='text-3xl ml-1'>{username ? username : '👋Hi.'}</span>
            <div className='flex gap-3 w-full'>
                <Chip color={'primary'} variant='flat'><div className='flex items-center gap-2'><PiCalendarBlankDuotone className='size-4' />{momentSH(createdAt).locale('zh-cn').calendar()} 加入</div></Chip>
            </div>
        </div>
    </section>
}

async function UserSection() {
    const { userId, username, image } = await getUserOrThrow()
    return <UpdateProfile userId={userId} username={username} image={image} />
}

function HeroSectionSkeleton() {
    return <section className='flex flex-col sm:flex-row sm:items-center gap-4 p-4'>
        <Avatar isBordered color={'primary'} className='size-16!' />
        <div className='flex flex-col gap-2'>
            <span className='text-3xl ml-1'>Loading...</span>
            <div className='flex gap-3 w-full'>
                <Chip color={'primary'} variant='flat'><div className='flex items-center gap-2'><PiCalendarBlankDuotone className='size-4' /><StoneSkeleton className='w-5 h-2 opacity-50 rounded-full' /> 加入</div></Chip>
            </div>
        </div>
    </section>
}

async function UpgradeServer() {
    const plan = await getPlan()
    return <Upgrade isOnFreeTier={plan === 'beginner'} />
}

export default async function Settings() {
    return <Main className='flex flex-col gap-4 max-w-(--breakpoint-sm)'>
        <Suspense fallback={<HeroSectionSkeleton />}>
            <HeroSection />
        </Suspense>
        <section className='flex flex-col gap-4 w-full justify-center items-center'>
            <div className='flex gap-4 w-full'>
                <Suspense fallback={<StoneSkeleton className='h-12 rounded-full'><Upgrade isOnFreeTier /></StoneSkeleton>}>
                    <UpgradeServer />
                </Suspense>
                <Suspense fallback={<StoneSkeleton className='flex-1 h-12 rounded-full'><ClaimDailyLexicoin hasClaimed /></StoneSkeleton>}>
                    <ClaimDailyLexicoinServer />
                </Suspense>
            </div>
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
            <div className='col-span-2'>
                <Streak />
            </div>
            <div className='col-span-2'>
                <Suspense fallback={<HeatmapSkeleton />}>
                    <UserWordHeatmap />
                </Suspense>
            </div>
            <div className='bg-default-50 rounded-2xl p-4 flex flex-col gap-2'>
                <H disableCenter className=''>英语偏好</H>
                <Suspense fallback={<StoneSkeleton className='w-full h-8 rounded-full' />}>
                    <Preference />
                </Suspense>
            </div>
            <div className='bg-default-50 rounded-2xl p-4 flex flex-col gap-2'>
                <H disableCenter className=''>通行密钥</H>
                <CopyToken />
            </div>
            <div className='col-span-2 flex flex-col gap-2'>
                <Suspense fallback={<UpdateProfileSkeleton />}>
                    <UserSection />
                </Suspense>
            </div>
        </section>
    </Main>
}



function LexicoinBalanceCard({ balance }: { balance?: number }) {
    return <GradientCard title='LexiCoin 余额' text={balance ? <ContinuousNumberFlow value={balance} /> : null} className='bg-linear-to-bl from-teal-100/80 to-lime-100/80 dark:from-gray-900 dark:to-gray-600'>
        <PiCoinsDuotone className='size-7' />
    </GradientCard>
}

async function LexicoinBalance() {
    const { userId } = await getUserOrThrow()
    const balance = await getLexicoinBalance(userId)
    return <LexicoinBalanceCard balance={balance} />
}

function PlanCard({ text }: { text?: string }) {
    return <GradientCard title='订阅计划' text={text} className='bg-linear-to-br to-rose-100/80 from-teal-100/80 dark:from-gray-900 dark:to-gray-600'>
        <PiPlanetDuotone className='size-7' />
    </GradientCard>
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
