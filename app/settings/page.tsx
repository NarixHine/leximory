import { Metadata } from 'next'
import H from '@/components/ui/h'
import { Avatar } from '@heroui/avatar'
import { Chip } from '@heroui/chip'
import { PiCalendarBlankDuotone, PiCoinsDuotone, PiPlanetDuotone } from 'react-icons/pi'
import moment from 'moment-timezone'
import { Suspense } from 'react'
import Main from '@/components/ui/main'
import Preference from './components/preference'
import CopyToken from './components/copy'
import { Skeleton } from '@heroui/skeleton'
import { getLexicoinBalance, getLastDailyClaim } from '@/server/db/lexicoin'
import GradientCard from '../library/components/cards/card'
import { planMap } from '@/lib/config'
import { ClaimDailyLexicoin } from './components/claim-daily-lexicoin'
import ContinuousNumberFlow from '@/components/ui/continuous-number-flow'
import Upgrade from './components/upgrade'
import { UserWordHeatmap } from '@/components/stats'
import { HeatmapSkeleton } from '@/components/stats/calendar'
import 'moment/locale/en-gb'
import 'moment/locale/zh-cn'
import { getPlan, getUserOrThrow } from '@/server/auth/user'
import UpdateProfile, { UpdateProfileSkeleton } from './components/update-profile'

export const metadata: Metadata = { title: '设置' }

async function HeroSection() {
    const { username, image, createdAt } = await getUserOrThrow()
    return <section className='flex flex-col sm:flex-row sm:items-center gap-4 p-4'>
        <Avatar src={image} isBordered color={'primary'} className='!size-16 ml-2 sm:ml-0' />
        <div className='flex flex-col gap-1'>
            <span className='text-3xl ml-1 font-mono'>{username ? `@${username}` : '👋Hi.'}</span>
            <div className='flex gap-3 w-full mt-2'>
                <Chip color={'primary'} variant='flat'><div className='flex items-center gap-2'><PiCalendarBlankDuotone className='size-4' />{moment(createdAt).locale('zh-cn').calendar()} 加入</div></Chip>
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
        <Avatar isBordered color={'primary'} className='!size-16' />
        <div className='flex flex-col gap-1'>
            <span className='text-3xl ml-1 font-mono'>@loading...</span>
            <div className='flex gap-3 w-full mt-2'>
                <Chip color={'primary'} variant='flat'><div className='flex items-center gap-2'><PiCalendarBlankDuotone className='size-4' /><Skeleton className='w-5 h-2 opacity-50 rounded-full' /> 加入</div></Chip>
            </div>
        </div>
    </section>
}

async function UpgradeServer() {
    const plan = await getPlan()
    return <Upgrade isOnFreeTier={plan === 'beginner'} />
}

export default async function Settings() {
    const month = moment().locale('en-gb').format('MMMM')
    return <Main className='flex flex-col gap-4 max-w-screen-sm'>
        <Suspense fallback={<HeroSectionSkeleton />}>
            <HeroSection />
        </Suspense>
        <section className='flex flex-col gap-4 w-full justify-center items-center'>
            <div className='flex gap-4 w-full'>
                <Suspense fallback={<Skeleton className='w-[109px] h-12 rounded-full' />}>
                    <UpgradeServer />
                </Suspense>
                <Suspense fallback={<Skeleton className='flex-1 h-12 rounded-full' />}>
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
            <div className='col-span-2 flex flex-col gap-2'>
                <Suspense fallback={<UpdateProfileSkeleton />}>
                    <UserSection />
                </Suspense>
            </div>
            <div className='border border-dashed border-secondary-200 rounded-lg p-4 flex flex-col gap-2'>
                <H disableCenter className=''>英语偏好</H>
                <Suspense fallback={<Skeleton className='w-full h-8 rounded-full' />}>
                    <Preference />
                </Suspense>
            </div>
            <div className='border border-dashed border-default-200 rounded-lg p-4 flex flex-col gap-2'>
                <H disableCenter className=''>通行密钥</H>
                <CopyToken />
            </div>
        </section>
        <div className='w-full pr-6 pl-0 py-3 flex flex-col gap-4'>
            <H usePlayfair className='items-end text-5xl text-primary-300 text-balance'>What you learned in {month}</H>
            <Suspense fallback={<HeatmapSkeleton />}>
                <UserWordHeatmap />
            </Suspense>
        </div>
    </Main>
}



function LexicoinBalanceCard({ balance }: { balance?: number }) {
    return <GradientCard title='LexiCoin 余额' text={balance ? <ContinuousNumberFlow value={balance} /> : null} className='bg-gradient-to-tl from-teal-100/80 to-lime-100/80 dark:from-gray-900 dark:to-gray-600'>
        <PiCoinsDuotone className='size-7' />
    </GradientCard>
}

async function LexicoinBalance() {
    const { userId } = await getUserOrThrow()
    const balance = await getLexicoinBalance(userId)
    return <LexicoinBalanceCard balance={balance} />
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
    const { userId } = await getUserOrThrow()
    const lastClaimDate = await getLastDailyClaim(userId)
    return <ClaimDailyLexicoin hasClaimed={lastClaimDate ? moment.tz(lastClaimDate, 'Asia/Shanghai').isSame(moment.tz('Asia/Shanghai'), 'day') : false} />
}
