import { getPaper } from '@repo/supabase/paper'
import { paperIdAtom } from '@repo/ui/paper/atoms'
import { questionStrategies } from '@repo/ui/paper/strategies'
import { HydrationBoundary } from 'jotai-ssr'
import { Metadata } from 'next'
import { experimental_taintObjectReference as taintObjectReference } from 'react'
import { Main } from '@repo/ui/main'
import { QuizTabs } from './components/quiz-tabs'
import { SubmitAnswers } from './components/submit-answers'
import { Suspense } from 'react'
import { Paper } from '@repo/ui/paper'
import { Spinner } from '@heroui/spinner'

type PaperPageProps = {
    params: Promise<{
        id: string
    }>
}

export async function generateMetadata({ params }: PaperPageProps): Promise<Metadata> {
    const id = (await params).id
    const paper = await getPaper({ id: parseInt(id) })
    return {
        title: `小试身手「${paper.title}」`,
    }
}

async function getData({ id }: { id: number }) {
    const { content } = await getPaper({ id })
    taintObjectReference('Do not pass raw paper data to the client', content)
    return content
}

export default function Page({ params }: PaperPageProps) {
    return (
        <Main className='max-w-160'>
            <Suspense fallback={<div className='absolute inset-0 flex justify-center items-center'>
                <Spinner variant='wave' size='lg' />
            </div>}>
                <Content params={params} />
            </Suspense>
        </Main>
    )
}

async function Content({ params }: { params: PaperPageProps['params'] }) {
    const { id } = await params
    const data = await getData({ id: parseInt(id) })
    const questionCount = data.reduce((count, item) => count + questionStrategies[item.type].getQuestionCount(item as any), 0)
    return (
        <HydrationBoundary hydrateAtoms={[
            [paperIdAtom, id],
        ]}>
            <QuizTabs Paper={<Paper data={data} />} />
            <SubmitAnswers questionCount={questionCount} />
        </HydrationBoundary>
    )
}
