import { getPaper } from '@repo/supabase/paper'
import { paperIdAtom, viewModeAtom, submittedAnswersAtom, editoryItemsAtom } from '@repo/ui/paper/atoms'
import { HydrationBoundary } from 'jotai-ssr'
import { Metadata } from 'next'
import { Main } from '@repo/ui/main'
import { Ask } from '@repo/ui/paper'
import HighlightedPaper from './components/highlighted-paper'
import { KeyIcon } from '@phosphor-icons/react/ssr'

export const metadata: Metadata = {
    title: 'AI 校对'
}

const getData = async ({ id }: { id: string }) => {
    const userAnswers = { '1': 'A', '2': 'C', '3': 'B' } // Mocked user answers
    const { content: quizData, title } = await getPaper({ id: parseInt(id) })
    return {
        userAnswers,
        quizData,
        title,
    }
}

export default async function AskAIPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const { userAnswers, quizData } = await getData({ id })
    return (
        <HydrationBoundary hydrateAtoms={[
            [paperIdAtom, id],
            [viewModeAtom, 'revise'],
            [submittedAnswersAtom, userAnswers],
            [editoryItemsAtom, quizData]
        ]}>
            <Main className='max-w-150'>
                <h1 className='text-3xl tracking-tight font-bold mb-4 text-balance items-center flex'>
                    <KeyIcon className='inline mr-1' />
                    校对答案
                </h1>
                <HighlightedPaper
                    data={quizData}
                />
            </Main>
            <Ask />
        </HydrationBoundary>
    )
}
