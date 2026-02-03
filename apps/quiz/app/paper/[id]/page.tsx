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
import { MarkForLater } from '@repo/ui/mark-for-later'
import { MarkedItemsPanel } from '@repo/ui/mark-for-later/panel'
import { getUser } from '@repo/user'
import { AddWorkingPaper } from '@/app/components/working-paper'

type PaperPageProps = {
    params: Promise<{
        id: string
    }>
}

export async function generateMetadata({ params }: PaperPageProps): Promise<Metadata> {
    const id = (await params).id
    const paper = await getPaper({ id: parseInt(id) })
    return {
        title: paper.title
    }
}

async function getData({ id }: { id: number }) {
    if (await getUser()) {
        const [{ content, title }, { data: submission }] = await Promise.all([getPaper({ id }), getPaperSubmissionAction({ paperId: id })])
        if (!submission) // only taint when the user hasn't submitted yet
            taintObjectReference('Do not pass raw paper data to the client', content)
        return {
            content,
            title,
            answers: submission?.answers
        }
    }
    else {
        const { content, title } = await getPaper({ id })
        return {
            content,
            title,
        }
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
    const { content, answers, title } = await getData({ id: parseInt(id) })
    const questionCount = content.reduce((count, item) => count + applyStrategy(item, (strategy, data) => strategy.getQuestionCount(data)), 0)
    return (
        <HydrationBoundary hydrateAtoms={[
            [paperIdAtom, id],
        ]}>
            <AddWorkingPaper id={parseInt(id)} title={title} />
            <h2 className='text-4xl mb-2 font-formal'>{title}</h2>
            <QuizTabs
                Paper={!answers && <>
                    <Paper data={content} />
                    <SubmitAnswers questionCount={questionCount} />
                    <MarkForLater />
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
        <MarkedItemsPanel />
        <HighlightedPaper
            data={quizData}
        />
        <Ask />
        <Define />
    </HydrationBoundary>
}
