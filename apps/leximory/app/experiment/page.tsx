import { Metadata } from 'next'
import { getTimelineData } from './data'
import ExperimentClient from './client'

export const metadata: Metadata = {
    title: '学习轨迹',
}

export default async function ExperimentPage() {
    const { days, maxCount } = await getTimelineData()
    
    return <ExperimentClient days={days} maxCount={maxCount} />
}