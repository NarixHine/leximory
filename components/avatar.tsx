import { clerkClient } from '@clerk/nextjs/server'
import { Avatar } from "@heroui/avatar"
import { Button } from "@heroui/button"
import Link from 'next/link'
import { Suspense } from 'react'

async function UserAvatarServer({ uid }: { uid: string }) {
    try {
        const { imageUrl } = await (await clerkClient()).users.getUser(uid)
        return <Avatar isBordered color={'primary'} src={imageUrl} size='sm' />
    } catch {
        return <Avatar isBordered color={'primary'} size='sm' />
    }
}

function UserAvatarFallback() {
    return <Avatar isBordered color={'primary'} size='sm' />
}

export default function UserAvatar({ uid }: { uid: string }) {
    return <Button
        as={Link}
        href={`/profile/${uid}`}
        variant='light'
        startContent={<Suspense fallback={<UserAvatarFallback />}>
            <UserAvatarServer uid={uid} />
        </Suspense>}
        className='p-0 rounded-full print:hidden'
        isIconOnly
    />
}

