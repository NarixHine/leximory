import Link from 'next/link'
import { Avatar } from '@heroui/avatar'
import { PiArrowRight } from 'react-icons/pi'
import { momentSH } from '@/lib/moment'
import type { AdminUser } from '../data-fetching'

function relativeTime(value: string | null) {
    if (!value) return '—'
    return momentSH(value).fromNow()
}

export default function RecentSignups({ users }: { users: AdminUser[] }) {
    return (
        <section className='flex flex-col gap-4 rounded-2xl bg-default-50 p-5'>
            <div className='flex items-center justify-between gap-4'>
                <h2 className='font-formal text-sm tracking-tight text-default-600'>
                    Recent signups
                </h2>
                <Link
                    href='/admin/users'
                    className='inline-flex items-center gap-1 text-xs text-default-600 transition-colors hover:text-foreground'
                >
                    View all
                    <PiArrowRight className='size-3.5' />
                </Link>
            </div>

            <div className='flex flex-col'>
                {users.length === 0 && (
                    <p className='py-6 text-center text-sm text-default-600'>No signups yet.</p>
                )}
                {users.map(user => (
                    <Link
                        key={user.id}
                        href={`/profile/${user.id}`}
                        className='-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-default-100'
                    >
                        <Avatar size='sm' src={user.avatarUrl ?? undefined} name={user.username} />
                        <div className='min-w-0 flex-1'>
                            <div className='truncate text-sm'>{user.username}</div>
                            <div className='truncate font-mono text-xs text-default-600'>
                                {user.email ?? 'No email'}
                            </div>
                        </div>
                        <span className='shrink-0 text-xs text-default-600'>
                            {relativeTime(user.createdAt)}
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    )
}
