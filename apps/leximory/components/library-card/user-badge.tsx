'use client'

import { Avatar } from '@heroui/avatar'
import { useQuery } from '@tanstack/react-query'
import { getUserProfileAction } from '@repo/service/user'

/** Client-side user badge that fetches profile data via TanStack Query. */
export default function UserBadge({ uid }: { uid: string }) {
    const { data: user, isSuccess } = useQuery({
        queryKey: ['user', uid],
        queryFn: async () => {
            const { data } = await getUserProfileAction({ id: uid })
            return data
        },
        staleTime: Infinity,
    })

    return (
        <div className='flex items-center gap-2'>
            <Avatar
                src={isSuccess ? user?.imageUrl ?? undefined : undefined}
                size='sm'
                className={!isSuccess ? 'animate-pulse' : ''}
            />
            <span className='font-mono text-sm text-default-500 truncate max-w-[16ch]'>
                {isSuccess ? (user?.name ?? 'User') : ''}
            </span>
        </div>
    )
}
