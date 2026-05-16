import { Metadata } from 'next'
import { getTimelineData } from '@/server/db/review'
import ExperimentClient from './client'
import { Suspense } from 'react'
import { PiCableCar } from 'react-icons/pi'
import Bell from './components/bell-server'
import { getUserOrThrow } from '@repo/user'

export const metadata: Metadata = {
    title: '学习轨迹',
}

export default async function ExperimentPage() {
    const { userId } = await getUserOrThrow()
    const { days, streak } = await getTimelineData(userId)

    return <ExperimentClient days={days} streak={streak} Header={
        <header className="mb-1 sm:ml-22">
            <div className='flex items-center gap-2'>
                <span className='text-sm font-mono uppercase tracking-wide text-default-400'>
                    <PiCableCar className='inline-block size-5' /> Forming Connections
                </span>
            </div>
            <h1 className="flex items-center flex-wrap gap-2">
                <div className='text-[22px] font-kaiti'>回忆旧知，创造新知</div>
                <div className='flex-1' />
                <Suspense>
                    <Bell />
                </Suspense>
            </h1>
        </header>
    } />
}
