import { QuizKey, QuizPaper } from '@/lib/editory/generators'
import QuizData from '@/lib/editory/types'
import { contentFontFamily } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { Accordion, AccordionItem } from '@heroui/react'

export default function Paper({
    data,
    accordianClassName,
    accordianItemClassName
}: {
    data: QuizData[] | null
    accordianClassName?: string
    accordianItemClassName?: string
}) {
    return <div>
        <div
            style={{
                fontFamily: contentFontFamily
            }}
            className={cn(
                'w-full mx-auto min-h-40 rounded focus:outline-none prose prose-blockquote:my-1.5 prose-table:my-3 prose-tr:border-b-0 prose-h1:my-1.5 prose-h1:text-2xl prose-h2:my-1.5 prose-h2:text-xl prose-h3:my-1.5 prose-h3:text-lg prose-p:my-3 prose-ul:my-0.5 prose-li:my-0 prose-img:my-2 dark:prose-invert',
                data?.length === 0 && 'hidden'
            )}
        >
            {data && <QuizPaper quizData={data}></QuizPaper>}
        </div>
        <Accordion className={cn('not-prose w-full', accordianClassName)}>
            <AccordionItem title='Key' className={cn('font-mono shadow-none', accordianItemClassName)} subtitle='Click to reveal' variant='splitted'>
                {data && <QuizKey quizData={data} />}
            </AccordionItem>
        </Accordion>
    </div>
}
