import { Avatar } from '@heroui/avatar'
import { getUserOrThrow } from '@repo/user'

export async function CurrentUserAvatar() {
    const user = await getUserOrThrow()
    return <Avatar src={user.image ?? undefined} isBordered color='primary' className='size-16!' />
}
