import { Avatar } from '@heroui/avatar'
import { Suspense } from 'react'
import { getUser } from '@repo/user'
import { Button } from '@heroui/button'
import { AvatarDropdown } from './dropdown'
import { PiUserCircleDuotone, PiUserCircleThin } from 'react-icons/pi'

export async function CurrentUserAvatar() {
    const user = await getUser()
    const { image } = user ?? {}
    return <AvatarDropdown
        isLoggedIn={!!user}
        trigger={<Button
            variant={'flat'}
            color='secondary'
            startContent={image ? <Avatar src={image} isBordered color='primary' className='size-16!' /> : <PiUserCircleThin size={40} />}
            radius='full'
            isIconOnly={true}
        />} />
}

function UserAvatarFallback() {
    return <Button
        variant='flat'
        color='secondary'
        radius='full'
        isIconOnly={true}
        startContent={<PiUserCircleThin size={40} />}
    />
}

export default function UserAvatar() {
    return (
        <Suspense fallback={<UserAvatarFallback />}>
            <CurrentUserAvatar />
        </Suspense>
    )
}
