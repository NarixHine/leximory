import { cn } from '@/lib/utils'
import { Avatar } from '@heroui/avatar'
import { Button } from '@heroui/button'
import { User } from '@heroui/user'
import moment from 'moment'
import 'moment/locale/zh-cn'
import { unstable_cacheLife as cacheLife } from 'next/cache'
import Link from 'next/link'
import { Suspense } from 'react'
import { getUserById, getUserOrThrow } from '@/server/auth/user'

moment.locale('zh-cn')

// Example: Avatar for current user
export async function CurrentUserAvatar() {
    const user = await getUserOrThrow()
    return <Avatar src={user.image ?? undefined} isBordered color='primary' className='!size-16' />
}

// If you need to fetch arbitrary users by id, implement a getUserById abstraction using Supabase.

async function UserAvatarServer({ uid, showInfo }: { uid: string, showInfo?: boolean }) {
    'use cache'
    cacheLife('days')
    try {
        const { image, username, lastActiveAt } = await getUserById(uid)
        return showInfo ? <User avatarProps={{ src: image ?? undefined }} description={`上次活跃：${moment(lastActiveAt).fromNow()}`} name={username ? username : 'User'} /> : <Avatar src={image ?? undefined} />
    } catch {
        return showInfo ? <User description={'Error.'} name={'User'} /> : <Avatar />
    }
}

function UserAvatarFallback({ showInfo }: { showInfo?: boolean }) {
    return showInfo ? <User description={'Loading ...'} name={'User'} /> : <Avatar />
}

export default function UserAvatar({ uid, showInfo }: { uid: string, showInfo?: boolean }) {
    return <Button
        as={Link}
        href={`/profile/${uid}`}
        variant='light'
        startContent={<Suspense fallback={<UserAvatarFallback showInfo={showInfo} />}>
            <UserAvatarServer uid={uid} showInfo={showInfo} />
        </Suspense>}
        className={cn('rounded-full print:hidden', !showInfo && 'p-0')}
        isIconOnly={!showInfo}
    />
}
