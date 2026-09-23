'use client'

import { useMemo } from 'react'
import { AreaChart } from '@/components/ui/area-chart'
import type { AdminOverview } from '../data-fetching'

export default function SignupsChart({ data }: { data: AdminOverview['signupsByDay'] }) {
    const { total, delta } = useMemo(() => {
        const total = data.reduce((sum, point) => sum + point.signups, 0)
        const recent = data.slice(-7).reduce((sum, point) => sum + point.signups, 0)
        const previous = data.slice(-14, -7).reduce((sum, point) => sum + point.signups, 0)

        if (previous === 0) {
            return { total, delta: recent > 0 ? 100 : 0 }
        }

        return { total, delta: Math.round(((recent - previous) / previous) * 100) }
    }, [data])

    return (
        <section className='flex flex-col gap-4 rounded-2xl bg-default-50 p-5'>
            <div className='flex items-start justify-between gap-4'>
                <div>
                    <h2 className='font-formal text-sm tracking-tight text-default-600'>
                        New signups
                    </h2>
                    <div className='mt-1 font-mono text-3xl leading-none tracking-tight tabular-nums'>
                        {total.toLocaleString()}
                    </div>
                    <p className='mt-1.5 text-xs text-default-500'>Last 30 days</p>
                </div>
                <span
                    className={
                        delta >= 0
                            ? 'rounded-full bg-secondary-100 px-2.5 py-1 font-mono text-xs text-secondary-700 tabular-nums'
                            : 'rounded-full bg-danger-50 px-2.5 py-1 font-mono text-xs text-danger-600 tabular-nums'
                    }
                >
                    {delta >= 0 ? '+' : ''}
                    {delta}% vs last week
                </span>
            </div>
            <AreaChart
                data={data}
                index='date'
                categories={['signups']}
                colors={['secondary']}
                startEndOnly
                showGridLines={false}
                allowDecimals={false}
                className='h-36'
            />
        </section>
    )
}

export function SignupsChartSkeleton() {
    return (
        <section className='flex flex-col gap-4 rounded-2xl bg-default-50 p-5'>
            <div className='h-4 w-24 animate-pulse rounded-full bg-default-100' />
            <div className='h-8 w-16 animate-pulse rounded-full bg-default-100' />
            <div className='h-36 w-full animate-pulse rounded-xl bg-default-100' />
        </section>
    )
}
