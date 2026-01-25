import { PAPER_CLASS_NAME } from '@/lib/styles'
import { cn, Accordion, AccordionItem } from '@heroui/react'
import { QuizItems } from '@repo/schema/paper'
import { merge } from 'es-toolkit'
import { highlightSubstrings } from '@repo/ui/paper/utils'
import { QuizAnswerSheetRSC, QuizPaperRSC } from '@repo/ui/paper/rsc'
import { QuizKey } from '@repo/ui/paper'

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
        <Accordion className={cn('not-prose w-full', accordionClassName)} defaultExpandedKeys={[]}>
            <AccordionItem
                key={'key'}
                title='Key'
                className={cn('shadow-none', accordionItemClassName)}
                classNames={{
                    trigger: 'pb-2'
                }}
                subtitle='点击以展开／折叠'
            >
                {data && <QuizKey quizData={data} />}
            </AccordionItem>
        </Accordion>
    )
}
