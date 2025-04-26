import { clerkClient } from '@clerk/nextjs/server'
import { Avatar } from '@heroui/avatar'
import moment from 'moment'
import 'moment/locale/zh-cn'
import { Chip } from '@heroui/chip'
import { PiCalendarBlankDuotone, PiNotebookDuotone } from 'react-icons/pi'
import H from '@/components/ui/h'
import { unstable_cacheLife as cacheLife } from 'next/cache'
import { summarizeLibsWithWords } from '@/server/db/lib'

export default async function UserInfo({ uid }: { uid: string }) {
    'use cache'
    cacheLife('days')
    moment.locale('zh-CN')

    const { username, imageUrl, createdAt } = await (await clerkClient()).users.getUser(uid)
    const data = await summarizeLibsWithWords({ filter: { 'lib.owner': uid } })
    const totalWordsLearned = data.reduce((acc: number, curr: { count: number }) => acc + curr.count, 0)
    return (
        <>
            <Avatar src={imageUrl} isBordered color={'primary'} className='!size-16' />
            {username && <H className='text-2xl !font-mono'>@{username}</H>}
            <div className='flex justify-center gap-6 w-full mt-2'>
                <div className='flex flex-col items-center gap-1'>
                    <span className='text-sm opacity-70 flex items-center gap-1'><PiCalendarBlankDuotone />加入时间</span>
                    <Chip color={'secondary'} variant='flat'>{moment(createdAt).calendar()}</Chip>
                </div>
                <div className='flex flex-col items-center gap-1'>
                    <span className='text-sm opacity-70 flex items-center gap-1'><PiNotebookDuotone />语料本容积</span>
                    <Chip color={'secondary'} variant='flat'>{totalWordsLearned} 个单词</Chip>
                </div>
            </div>
        </>
    )
} 