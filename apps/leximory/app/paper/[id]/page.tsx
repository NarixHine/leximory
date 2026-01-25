import { getPaper } from '@repo/supabase/paper'
import { paperIdAtom } from '@repo/ui/paper/atoms'
import { questionStrategies } from '@repo/ui/paper/strategies'
import { HydrationBoundary } from 'jotai-ssr'
import { Metadata } from 'next'
import { taintObjectReference } from 'next/dist/server/app-render/entry-base'
import Main from '@/components/ui/main'
import { QuizTabs } from './components/quiz-tabs'
import { SubmitAnswers } from './components/submit-answers'
import { AnswerSheet, Paper } from '@repo/ui/paper'

export const metadata: Metadata = {
    title: '小练习'
}

async function getData({ id }: { id: number }) {
    const { content } = await getPaper({ id })
    taintObjectReference('Do not pass raw paper data to the client', content)
    return content
}

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const data = await getData({ id: parseInt(id) })
    const questionCount = data.reduce((count, item) => count + questionStrategies[item.type].getQuestionCount(item as any), 0)
    return (
        <HydrationBoundary hydrateAtoms={[
            [paperIdAtom, id],
        ]}>
            <Main className='max-w-150'>
                <QuizTabs Paper={<Paper data={data} />} AnswerSheet={<AnswerSheet data={data} />} />
                <SubmitAnswers questionCount={questionCount} />
            </Main>
        </HydrationBoundary>
    )
}
