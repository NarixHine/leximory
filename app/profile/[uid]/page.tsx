import Center from '@/components/ui/center'
import H from '@/components/ui/h'
import { clerkClient } from '@clerk/nextjs/server'
import { Avatar } from "@heroui/avatar"
import moment from 'moment'
import 'moment/locale/zh-cn'
import { Suspense } from 'react'
import WordStats from '@/components/stats'
import { WordChartSkeleton } from '@/components/stats/word-chart'
import { Chip } from "@heroui/chip"
import { PiCalendarBlankDuotone, PiNotebookDuotone } from 'react-icons/pi'
import { summarizeLibsWithWords } from '@/server/db/lib'

export default async function ProfilePage({ params }: { params: Promise<{ uid: string }> }) {
    moment.locale('zh-CN')
    const uid = (await params).uid
    const { username, imageUrl, createdAt } = await (await clerkClient()).users.getUser(uid)
    const data = await summarizeLibsWithWords({ filter: { 'lib.owner': uid } })
    const totalWordsLearned = data.reduce((acc, curr) => acc + curr.count, 0)
    return <Center>
        <div className='flex flex-col items-center gap-4 max-w-md'>
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
            <div className='my-12 h-80 w-full sm:min-w-96'>
                <Suspense fallback={<WordChartSkeleton />}>
                    <WordStats uid={uid} />
                </Suspense>
            </div>
        </div>
    </Center>
}
