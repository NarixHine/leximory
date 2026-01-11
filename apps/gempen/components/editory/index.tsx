import { QuizKey } from '@/components/editory/generators'
import { Accordion, AccordionItem } from '@heroui/accordion'
import { cn } from '@heroui/theme'
import { QuizItems } from './generators/types'
import { QuizAnswerSheetRSC, QuizPaperRSC } from './generators/rsc'
import { merge } from 'es-toolkit'
import { highlightSubstrings } from './blank/utils'
import { PAPER_CLASS_NAME } from '@/lib/styles'

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

export function AnswerSheet({
    data,
    className,
}: {
    className?: string
    data: QuizItems
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
            {data && <QuizAnswerSheetRSC quizData={data}></QuizAnswerSheetRSC>}
        </div>
    )
}

export function Key({
    data,
    accordionClassName,
    accordionItemClassName
}: {
    data: QuizItems
    accordionClassName?: string
    accordionItemClassName?: string
}) {
    return (
        <Accordion className={cn('not-prose w-full', accordionClassName)} defaultExpandedKeys={['key']}>
            <AccordionItem key={'key'} title='Key' className={cn('shadow-none', accordionItemClassName)} subtitle='点击以展开／折叠'>
                {data && <QuizKey quizData={data} />}
            </AccordionItem>
        </Accordion>
    )
}
