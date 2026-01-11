import { Avatar } from '@heroui/avatar'
import { Chip } from '@heroui/chip'
import { PiCalendarBlankDuotone, PiNotebookDuotone } from 'react-icons/pi'
import H from '@/components/ui/h'
import { cacheLife } from 'next/cache'
import { getUserById } from '@repo/user'
import { momentSH } from '@/lib/moment'
import 'moment/locale/zh-cn'

export default async function UserInfo({ uid }: { uid: string }) {
    'use cache'
    cacheLife('days')

    const { username, image, lastActiveAt, createdAt } = await getUserById(uid)
    return (
        <>
            <Avatar src={image} isBordered color={'primary'} className='size-16!' />
            {username && <H className='text-2xl font-mono!'>{username}</H>}
            <div className='flex justify-center gap-3 w-full -mt-2'>
                <div className='flex flex-col items-center gap-1'>
                    <span className='text-sm opacity-70 flex items-center gap-1'><PiCalendarBlankDuotone />加入时间</span>
                    <Chip color={'secondary'} variant='flat'>{momentSH(createdAt).calendar()}</Chip>
                </div>
                <div className='flex flex-col items-center gap-1'>
                    <span className='text-sm opacity-70 flex items-center gap-1'><PiNotebookDuotone />上次登录</span>
                    <Chip color={'secondary'} variant='flat'>{momentSH(lastActiveAt).locale('zh-cn').fromNow()}</Chip>
                </div>
            </div>
        </>
    )
} 