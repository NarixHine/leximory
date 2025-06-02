import { cn } from '@/lib/utils'
import { clerkClient } from '@clerk/nextjs/server'
import { Avatar } from "@heroui/avatar"
import { Button } from "@heroui/button"
import { User } from '@heroui/user'
import moment from 'moment'
import 'moment/locale/zh-cn'
import { unstable_cacheLife as cacheLife } from 'next/cache'
import Link from 'next/link'
import { Suspense } from 'react'

moment.locale('zh-cn')

async function UserAvatarServer({ uid, showInfo }: { uid: string, showInfo?: boolean }) {
    'use cache'
    cacheLife('days')
    try {
        const { imageUrl, username, lastActiveAt } = await (await clerkClient()).users.getUser(uid)
        return showInfo ? <User avatarProps={{ src: imageUrl }} description={`上次活跃：${moment(lastActiveAt).fromNow()}`} name={username ? `@${username}` : 'User'} /> : <Avatar src={imageUrl} />
    } catch {
        return showInfo ? <User description={'Error.'} name={'@user'} /> : <Avatar />
    }
}

function UserAvatarFallback({ showInfo }: { showInfo?: boolean }) {
    return showInfo ? <User description={'Loading ...'} name={'@user'} /> : <Avatar />
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
