import { getPaper } from '@repo/supabase/paper'
import { editoryItemsAtom, paperIdAtom, passcodeAtom, submittedAnswersAtom, viewModeAtom } from '@repo/ui/paper/atoms'
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
import { SectionAnswers, QuizItems, SubmissionFeedback, SUBJECTIVE_TYPES } from '@repo/schema/paper'
import { KeyIcon } from '@phosphor-icons/react/ssr'
import { applyStrategy, computeTotalScore, computePerfectScore } from '@repo/ui/paper/utils'
import Leaderboard from './components/leaderboard'
import Dictation from './components/dictation'
import { Define } from '@repo/ui/define'
import { MarkForLater } from '@repo/ui/mark-for-later'
import { MarkedItemsPanel } from '@repo/ui/mark-for-later/panel'
import { AddWorkingPaper } from '@/app/components/working-paper'
import { Kilpi } from '@repo/service/kilpi'
import { SubjectiveFeedbackPanel } from './components/subjective-feedback'

type PaperPageProps = {
    params: Promise<{
        id: string
    }>
    searchParams: Promise<{
        passcode?: string
    }>
}

export async function generateMetadata({ params }: PaperPageProps): Promise<Metadata> {
    const id = (await params).id
    const paper = await getPaper({ id: parseInt(id) })
    return {
        title: paper.title
    }
}

async function getData({ id, passcode }: { id: number, passcode?: string }) {
    const [{ data }, paper] = await Promise.all([
        getPaperSubmissionAction({ paperId: id }),
        (async () => {
            const paper = await getPaper({ id })
            await Kilpi.papers.read({ ...paper, providedPasscode: passcode }).authorize().assert()
            return paper
        })()
    ])
    const submission = data?.submission

    if (submission) {
        return {
            content: paper.content,
            title: paper.title,
            answers: submission.answers,
            feedback: submission.feedback as SubmissionFeedback | null,
            score: submission.score,
        }
    }
    else {
        taintObjectReference('Do not pass raw paper data to the client', paper.content)
        return {
            content: paper.content,
            title: paper.title,
        }
    }
}

export default function Page({ params, searchParams }: PaperPageProps) {
    return (
        <Main className='max-w-160'>
            <Suspense fallback={<div className='absolute inset-0 flex justify-center items-center'>
                <Spinner variant='wave' size='lg' />
            </div>}>
                <Content params={params} searchParams={searchParams} />
            </Suspense>
        </Main>
    )
}

async function Content({ params, searchParams }: { params: PaperPageProps['params'], searchParams: PaperPageProps['searchParams'] }) {
    const [{ id }, { passcode }] = await Promise.all([params, searchParams])
    const { content, answers, title, feedback, score } = await getData({ id: parseInt(id), passcode })
    const questionCount = content.reduce((count, item) => count + applyStrategy(item, (strategy, data) => strategy.getQuestionCount(data)), 0)

    return (
        <HydrationBoundary hydrateAtoms={[
            [paperIdAtom, id],
            [passcodeAtom, passcode ?? null],
        ]}>
            <AddWorkingPaper id={parseInt(id)} title={title} />
            <h2 className='text-4xl mb-2 font-formal'>{title}</h2>
            <QuizTabs
                {...(!!answers ? {
                    Revise: <RevisePaper quizData={content} answers={answers} feedback={feedback ?? undefined} serverScore={score} />
                } : {
                    Paper: <>
                        <Paper data={content} />
                        <SubmitAnswers questionCount={questionCount} />
                        <MarkForLater />
                    </>
                })}
                leaderboard={<Leaderboard paperId={parseInt(id)} />}
                dictation={<Suspense fallback={<div className='flex justify-center py-8'><Spinner /></div>}>
                    <Dictation paperId={parseInt(id)} />
                </Suspense>}
            />
        </HydrationBoundary>
    )
}

function RevisePaper({ quizData, answers, feedback, serverScore }: { quizData: QuizItems, answers: SectionAnswers, feedback?: SubmissionFeedback, serverScore?: number }) {
    const objectiveScore = computeTotalScore(quizData, answers)
    const hasSubjective = quizData.some(
        (section) => (SUBJECTIVE_TYPES as readonly string[]).includes(section.type)
    )
    // Use server score (which includes subjective marks) if available
    const displayScore = serverScore ?? objectiveScore
    const isMarkingPending = hasSubjective && !feedback

    return <HydrationBoundary hydrateAtoms={[
        [viewModeAtom, 'revise'],
        [submittedAnswersAtom, answers],
        [editoryItemsAtom, quizData]
    ]}>
        <h1 className='font-bold mt-2 mb-5 text-balance items-baseline flex'>
            <span className='text-5xl'>{displayScore}</span>
            <span className='ml-1 text-default-400 text-xl flex items-center'>
                /{computePerfectScore(quizData)} <KeyIcon className='ml-1 size-5' />
            </span>
        </h1>
        {isMarkingPending && (
            <div className='flex items-center gap-2 p-3 rounded-medium bg-warning-50 text-warning-700 mb-4'>
                <Spinner size='sm' />
                <span className='text-sm'>主观题正在批改中，请稍后刷新查看结果……</span>
            </div>
        )}
        <MarkedItemsPanel />
        <HighlightedPaper
            data={quizData}
        />
        {feedback && <SubjectiveFeedbackPanel quizData={quizData} answers={answers} feedback={feedback} />}
        <Ask />
        <Define />
    </HydrationBoundary>
}
