import { Avatar } from '@heroui/avatar'
import { Suspense } from 'react'
import { getUser } from '@repo/user'
import { Button } from '@heroui/button'
import { AvatarDropdown } from './dropdown'

export async function CurrentUserAvatar() {
    const user = await getUser()
    const { image } = user ?? {}
    return <Avatar src={image} isBordered color='primary' className='size-16!' />
}

function UserAvatarFallback() {
    return <Avatar />
}

export default function UserAvatar() {
    return (
        <AvatarDropdown trigger={<Button
            variant='light'
            startContent={<Suspense fallback={<UserAvatarFallback />}>
                <CurrentUserAvatar />
            </Suspense>}
            className={'rounded-full'}
            isIconOnly={true}
        />} />
    )
}
