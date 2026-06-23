import { Metadata } from 'next'
import Main from '@/components/ui/main'
import { ReviewContentBoundary } from './components/review-content-boundary'
import { ReviewHeader } from './components/review-header'

export const metadata: Metadata = {
    title: '学习轨迹',
}

export default function ExperimentPage() {
    return (
        <Main>
            <div className='max-w-2xl mx-auto'>
                <ReviewHeader />
                <ReviewContentBoundary />
            </div>
        </Main>
    )
}
