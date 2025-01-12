import { clerkClient } from '@clerk/nextjs/server'
import { Avatar } from '@nextui-org/avatar'
import { Button } from '@nextui-org/button'
import Link from 'next/link'
import { Suspense } from 'react'

async function UserAvatarServer({ uid }: { uid: string }) {
    const { imageUrl } = await (await clerkClient()).users.getUser(uid)
    return <Avatar isBordered color={'secondary'} src={imageUrl} size='sm' />
}

function UserAvatarFallback() {
    return <Avatar isBordered color={'secondary'} size='sm' />
}

export default function UserAvatar({ uid }: { uid: string }) {
    return <Button
        as={Link}
        href={`/profile/${uid}`}
        variant='light'
        startContent={<Suspense fallback={<UserAvatarFallback />}>
            <UserAvatarServer uid={uid} />
        </Suspense>}
        className='p-0 rounded-full'
        isIconOnly
    />
}
