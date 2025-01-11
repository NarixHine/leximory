import { stringToColor } from '@/lib/utils'
import { clerkClient } from '@clerk/nextjs/server'
import { Avatar } from '@nextui-org/avatar'
import { Button } from '@nextui-org/button'
import Link from 'next/link'
import { Suspense } from 'react'

async function UserAvatarServer({ uid }: { uid: string }) {
    const { imageUrl } = await (await clerkClient()).users.getUser(uid)
    return <Avatar isBordered color={stringToColor(uid)} src={imageUrl} size='sm' />
}

function UserAvatarFallback({ uid }: { uid: string }) {
    return <Avatar isBordered color={stringToColor(uid)} size='sm' />
}

export default function UserAvatar({ uid }: { uid: string }) {
    return <Button
        as={Link}
        href={`/profile/${uid}`}
        variant='light'
        startContent={<Suspense fallback={<UserAvatarFallback uid={uid} />}>
            <UserAvatarServer uid={uid} />
        </Suspense>}
        className='p-0 rounded-full'
        isIconOnly
    />
}
