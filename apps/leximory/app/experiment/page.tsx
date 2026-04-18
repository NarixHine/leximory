import { Metadata } from 'next'
import { getTimelineData } from './data'
import { Timeline } from './components/timeline'
import { Suspense } from 'react'
import { PiCaretLeft, PiCaretRight } from 'react-icons/pi'
import Main from '@/components/ui/main'

export const metadata: Metadata = {
    title: '学习轨迹',
}

export default async function ExperimentPage() {
    return (
        <Main>
            <div className="max-w-2xl mx-auto px-6 py-10">
                {/* Navigation */}
                <nav className="flex items-center justify-between mb-10">
                    <div className="inline-flex items-center bg-default-100/60 rounded-full p-1">
                        <button className="p-2 rounded-full hover:bg-white transition-all text-default-400 hover:text-default-600">
                            <PiCaretLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-medium text-default-700 px-3">4月</span>
                        <button className="p-2 rounded-full hover:bg-white transition-all text-default-400 hover:text-default-600">
                            <PiCaretRight className="w-4 h-4" />
                        </button>
                    </div>
                </nav>
                
                {/* Title */}
                <header className="mb-10">
                    <h1 className="text-4xl sm:text-5xl font-serif font-normal text-default-800 tracking-tight">
                        Apr ’26
                    </h1>
                </header>
                
                {/* Timeline */}
                <Suspense fallback={<TimelineSkeleton />}>
                    <TimelineSection />
                </Suspense>
            </div>
        </Main>
    )
}

async function TimelineSection() {
    const { days, maxCount } = await getTimelineData()
    return <Timeline days={days} maxCount={maxCount} />
}

function TimelineSkeleton() {
    return (
        <div className="space-y-8 animate-pulse">
            <div className="h-28 bg-default-100 rounded-2xl" />
            <div className="space-y-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-6 py-2">
                        <div className="w-16 h-8 bg-default-100 rounded" />
                        <div className="w-2 h-2 bg-default-100 rounded-full mt-2" />
                        <div className="flex-1 h-6 bg-default-100 rounded" />
                    </div>
                ))}
            </div>
        </div>
    )
}
