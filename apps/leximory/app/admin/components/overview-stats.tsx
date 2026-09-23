import type { IconType } from 'react-icons'
import {
    PiCrownSimpleDuotone,
    PiPulseDuotone,
    PiUserPlusDuotone,
    PiUsersThreeDuotone,
} from 'react-icons/pi'
import type { AdminOverview } from '../data-fetching'

function StatCard({
    label,
    value,
    caption,
    icon: Icon,
}: {
    label: string
    value: number
    caption: string
    icon: IconType
}) {
    return (
        <div className='flex min-h-30 flex-col justify-between gap-4 rounded-2xl bg-linear-to-br from-default-50 to-default-100 p-4 dark:from-default-100 dark:to-default-200/40'>
            <div className='flex items-center justify-between gap-2'>
                <span className='font-formal text-sm tracking-tight text-default-600'>
                    {label}
                </span>
                <Icon className='size-5 shrink-0 text-default-400' />
            </div>
            <div>
                <div className='font-mono text-3xl leading-none tracking-tight tabular-nums'>
                    {value.toLocaleString()}
                </div>
                <div className='mt-2 text-xs text-default-600'>{caption}</div>
            </div>
        </div>
    )
}

export default function OverviewStats({ overview }: { overview: AdminOverview }) {
    const { totalUsers, activeUsers, newThisWeek, newThisMonth, paidUsers } = overview

    const activeShare = totalUsers ? Math.round((activeUsers / totalUsers) * 100) : 0
    const paidShare = totalUsers ? Math.round((paidUsers / totalUsers) * 100) : 0

    return (
        <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
            <StatCard
                label='Total users'
                value={totalUsers}
                caption={`+${newThisMonth.toLocaleString()} in the last 30 days`}
                icon={PiUsersThreeDuotone}
            />
            <StatCard
                label='Active users'
                value={activeUsers}
                caption={`${activeShare}% of all accounts`}
                icon={PiPulseDuotone}
            />
            <StatCard
                label='New signups'
                value={newThisWeek}
                caption='Joined in the last 7 days'
                icon={PiUserPlusDuotone}
            />
            <StatCard
                label='Paid users'
                value={paidUsers}
                caption={`${paidShare}% of all accounts`}
                icon={PiCrownSimpleDuotone}
            />
        </div>
    )
}
