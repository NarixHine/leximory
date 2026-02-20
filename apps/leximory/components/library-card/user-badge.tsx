'use client'

import { Avatar } from '@heroui/avatar'
import { useUserProfile } from '@/lib/hooks/use-user-profile'

/** Client-side user badge that fetches profile data via TanStack Query. */
export default function UserBadge({ uid }: { uid: string }) {
    const { data: user, isSuccess } = useUserProfile(uid)

    return (
        <div className='flex items-center gap-2'>
            <Avatar
                src={isSuccess ? user?.imageUrl ?? undefined : undefined}
                size='sm'
                className={!isSuccess ? 'animate-pulse' : ''}
            />
            {isSuccess ? (
                <span className='font-mono text-sm text-default-500 truncate max-w-[16ch]'>
                    {user?.name ?? 'User'}
                </span>
            ) : (
                <span className='inline-block h-4 w-20 animate-pulse rounded bg-default-200' />
            )}
        </div>
    )
}
