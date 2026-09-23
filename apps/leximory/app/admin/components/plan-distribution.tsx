import { PLANS } from '@repo/env/config'
import { cn } from '@/lib/utils'
import type { AdminOverview } from '../data-fetching'
import { PLAN_BAR } from '../plan'
import PlanTag from './plan-tag'

export default function PlanDistribution({ overview }: { overview: AdminOverview }) {
    const { planCounts, totalUsers, verifiedUsers } = overview

    return (
        <section className='flex flex-col gap-5 rounded-2xl bg-default-50 p-5'>
            <div className='flex items-baseline justify-between gap-4'>
                <h2 className='font-formal text-sm tracking-tight text-default-600'>
                    Plan distribution
                </h2>
                <span className='font-mono text-xs text-default-600 tabular-nums'>
                    {totalUsers.toLocaleString()} total
                </span>
            </div>

            <div className='flex flex-col gap-4'>
                {PLANS.map(plan => {
                    const count = planCounts[plan]
                    const share = totalUsers ? (count / totalUsers) * 100 : 0

                    return (
                        <div key={plan} className='flex items-center gap-3'>
                            <div className='w-24 shrink-0'>
                                <PlanTag plan={plan} />
                            </div>
                            <div className='h-1.5 flex-1 overflow-hidden rounded-full bg-default-200/70'>
                                <div
                                    className={cn(
                                        'h-full rounded-full transition-all',
                                        PLAN_BAR[plan],
                                    )}
                                    style={{ width: `${Math.max(share, count > 0 ? 2 : 0)}%` }}
                                />
                            </div>
                            <span className='w-10 shrink-0 text-right font-mono text-sm tabular-nums'>
                                {count.toLocaleString()}
                            </span>
                        </div>
                    )
                })}
            </div>

            <div className='flex items-center justify-between border-t border-default-200/70 pt-4 text-xs text-default-600'>
                <span className='font-formal'>Email verified</span>
                <span className='font-mono tabular-nums'>
                    {verifiedUsers.toLocaleString()} / {totalUsers.toLocaleString()}
                </span>
            </div>
        </section>
    )
}
