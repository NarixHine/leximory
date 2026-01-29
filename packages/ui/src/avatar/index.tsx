import { Avatar } from '@heroui/avatar'
import { User } from '@heroui/user'
import { cn } from '@heroui/theme'
import { getUserById } from '@repo/user'
import moment from 'moment'
import { cacheLife } from 'next/cache'
import { Suspense } from 'react'
import LinkButton from '../link-button'

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
    return <LinkButton
        href={`/profile/${uid}`}
        variant='light'
        startContent={<Suspense fallback={<UserAvatarFallback showInfo={showInfo} />}>
            <UserAvatarServer uid={uid} showInfo={showInfo} />
        </Suspense>}
        className={cn('rounded-full print:hidden', !showInfo && 'p-0')}
        isIconOnly={!showInfo}
    />
}
