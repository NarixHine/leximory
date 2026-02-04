import { Accordion } from '../accordion'
import { cn } from '@heroui/react'
import { QuizItems } from '@repo/schema/paper'
import { merge } from 'es-toolkit'
import { highlightSubstrings, PAPER_CLASS_NAME } from '@repo/ui/paper/utils'
import { QuizPaperRSC } from '@repo/ui/paper/rsc'
import { QuizKey } from './generators'

export { Ask } from './blank/ask'

export function Paper({
    data,
    className,
    highlights,
}: {
    className?: string
    data: QuizItems
    highlights?: Record<string, string[]>
}) {
    return (
        <div
            className={cn(
                'w-full mx-auto min-h-40 max-w-none focus:outline-none',
                data?.length === 0 && 'hidden',
                PAPER_CLASS_NAME,
                className
            )}
        >
            {highlights
                ? <QuizPaperRSC quizData={data.map(item => merge(item, 'text' in item ? { text: highlightSubstrings(item.text, highlights[item.id] ?? []) } : {}))}></QuizPaperRSC>
                : <QuizPaperRSC quizData={data}></QuizPaperRSC>}
        </div>
    )
}
