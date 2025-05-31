import { generateKey } from '@/lib/editory/generators'
import { generatePaper } from '@/lib/editory/generators'
import QuizData from '@/lib/editory/types'
import { postFontFamily } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { Accordion, AccordionItem } from '@heroui/react'

export default function Paper({
    data
}: {
    data: QuizData[] | null
}) {
    return <div>
        <div
            style={{
                fontFamily: postFontFamily
            }}
            className={cn(
                'w-full mx-auto min-h-40 p-4 rounded focus:outline-none prose prose-blockquote:my-1.5 prose-table:my-3 prose-tr:border-b-0 prose-h1:my-1.5 prose-h1:text-2xl prose-h2:my-1.5 prose-h2:text-xl prose-h3:my-1.5 prose-h3:text-lg prose-p:my-3 prose-ul:my-0.5 prose-li:my-0 prose-img:my-2 dark:prose-invert',
                data?.length === 0 && 'hidden'
            )}
            dangerouslySetInnerHTML={{ __html: generatePaper(data ?? []) }}
        />
        <Accordion>
            <AccordionItem title='Key' className='font-mono shadow-none' subtitle='Click to reveal' variant='splitted'>
                <div
                    dangerouslySetInnerHTML={{ __html: generateKey(data ?? []) }}
                />
            </AccordionItem>
        </Accordion>
    </div>
}
