import { Avatar } from '@heroui/avatar'
import { Suspense } from 'react'
import { getUser } from '@repo/user'
import { Button } from '@heroui/button'
import { AvatarDropdown } from './dropdown'
import { PiUserCircleDuotone } from 'react-icons/pi'
import { getCommentaryQuota } from '@repo/user/quota'

export async function CurrentUserAvatar({ quotaModalChildren }: { quotaModalChildren?: React.ReactNode }) {
    const user = await getUser()
    const { image } = user ?? {}
    return <AvatarDropdown
        quotaModalChildren={quotaModalChildren}
        quotaPromise={user ? getCommentaryQuota() : undefined}
        isLoggedIn={!!user}
        trigger={<Button
            variant={'light'}
            color='secondary'
            startContent={image ? <Avatar src={image} isBordered color='primary' className='size-16!' /> : <PiUserCircleDuotone size={30} />}
            radius='full'
            isIconOnly={true}
            className='print:hidden'
        />} />
}

function UserAvatarFallback() {
    return <Button
        variant='light'
        color='secondary'
        radius='full'
        isIconOnly={true}
        startContent={<PiUserCircleDuotone size={30} />}
    />
}

export default function UserAvatar({ quotaModalChildren }: { quotaModalChildren?: React.ReactNode }) {
    return (
        <Suspense fallback={<UserAvatarFallback />}>
            <CurrentUserAvatar quotaModalChildren={quotaModalChildren} />
        </Suspense>
    )
}
