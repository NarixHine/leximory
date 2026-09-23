import { Suspense } from 'react'
import { getAdminOverview } from './data-fetching'
import OverviewStats from './components/overview-stats'
import SignupsChart, { SignupsChartSkeleton } from './components/signups-chart'
import PlanDistribution from './components/plan-distribution'
import RecentSignups from './components/recent-signups'

export default function AdminPage() {
    return (
        <Suspense fallback={<OverviewSkeleton />}>
            <AdminOverviewContent />
        </Suspense>
    )
}

async function AdminOverviewContent() {
    const overview = await getAdminOverview()

    return (
        <div className='flex flex-col gap-6'>
            <section className='flex flex-col gap-1'>
                <h2 className='font-formal text-2xl tracking-tight'>Overview</h2>
            </section>

            <OverviewStats overview={overview} />

            <SignupsChart data={overview.signupsByDay} />

            <div className='grid grid-cols-1 gap-3 lg:grid-cols-2'>
                <PlanDistribution overview={overview} />
                <RecentSignups users={overview.recentUsers} />
            </div>
        </div>
    )
}

function OverviewSkeleton() {
    return (
        <div className='flex flex-col gap-6'>
            <div className='flex flex-col gap-2'>
                <div className='h-7 w-32 animate-pulse rounded-full bg-default-100' />
                <div className='h-3 w-80 max-w-full animate-pulse rounded-full bg-default-100' />
            </div>
            <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className='min-h-30 animate-pulse rounded-2xl bg-default-100'
                    />
                ))}
            </div>
            <SignupsChartSkeleton />
            <div className='grid grid-cols-1 gap-3 lg:grid-cols-2'>
                <div className='h-56 animate-pulse rounded-2xl bg-default-100' />
                <div className='h-56 animate-pulse rounded-2xl bg-default-100' />
            </div>
        </div>
    )
}
