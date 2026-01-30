import { getPaper } from '@repo/supabase/paper'
import { editoryItemsAtom, paperIdAtom, submittedAnswersAtom, viewModeAtom } from '@repo/ui/paper/atoms'
import { HydrationBoundary } from 'jotai-ssr'
import { Metadata } from 'next'
import { experimental_taintObjectReference as taintObjectReference } from 'react'
import { Main } from '@repo/ui/main'
import { QuizTabs } from './components/quiz-tabs'
import { SubmitAnswers } from './components/submit-answers'
import { Suspense } from 'react'
import { Ask, Paper } from '@repo/ui/paper'
import { Spinner } from '@heroui/spinner'
import { getPaperSubmissionAction } from '@repo/service/paper'
import HighlightedPaper from './components/highlighted-paper'
import { Answers, QuizItems } from '@repo/schema/paper'
import { KeyIcon } from '@phosphor-icons/react/ssr'
import { applyStrategy, computeTotalScore, computePerfectScore } from '@repo/ui/paper/utils'
import Leaderboard from './components/leaderboard'
import { Define } from '@repo/ui/define'

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
    const [{ content }, { data: submission }] = await Promise.all([getPaper({ id }), getPaperSubmissionAction({ paperId: id })])
    if (!submission) // allow tainting only when the user hasn't submitted yet
        taintObjectReference('Do not pass raw paper data to the client', content)
    return {
        content,
        answers: submission?.answers
    }
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
    const { content, answers } = await getData({ id: parseInt(id) })
    const questionCount = content.reduce((count, item) => count + applyStrategy(item, (strategy, data) => strategy.getQuestionCount(data)), 0)
    return (
        <HydrationBoundary hydrateAtoms={[
            [paperIdAtom, id],
        ]}>
            <QuizTabs
                Paper={!answers && <>
                    <Paper data={content} />
                    <SubmitAnswers questionCount={questionCount} />
                </>}
                Revise={answers && <RevisePaper quizData={content} answers={answers} />}
                leaderboard={<Leaderboard paperId={parseInt(id)} />}
            />
        </HydrationBoundary>
    )
}

function RevisePaper({ quizData, answers }: { quizData: QuizItems, answers: Answers }) {
    return <HydrationBoundary hydrateAtoms={[
        [viewModeAtom, 'revise'],
        [submittedAnswersAtom, answers],
        [editoryItemsAtom, quizData]
    ]}>
        <h1 className='font-bold mt-2 mb-5 text-balance items-baseline flex'>
            <span className='text-5xl'>{computeTotalScore(quizData, answers)}</span>
            <span className='ml-1 text-default-400 text-xl flex items-center'>
                /{computePerfectScore(quizData)} <KeyIcon className='ml-1 size-5' />
            </span>
        </h1>
        <HighlightedPaper
            data={quizData}
        />
        <Ask />
        <Define />
    </HydrationBoundary>
}
