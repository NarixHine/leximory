'use client'

import { Drawer } from 'vaul'
import { queryOptions, experimental_streamedQuery as streamedQuery, useQuery } from '@tanstack/react-query'
import { Streamdown } from 'streamdown'
import { Spinner } from '@heroui/spinner'
import { streamExplanationAction } from '@repo/service/paper'
import { cn } from '@heroui/theme'
import { useEffectEvent, useEffect } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { askParamsAtom, highlightsAtom, openAskAtom } from './atoms'
import { AskResponseSchema } from '@repo/schema/paper'
import { StreamExplanationParams } from '@repo/service/paper'
import { toast } from 'sonner'
import { Button, ButtonProps } from '@heroui/button'
import { StudentIcon } from '@phosphor-icons/react'
import { useScrollToMatch } from './hooks'
import { QuizLogo } from '../../logo'
import { hashAskParams } from '@repo/utils/paper'
import { last } from 'es-toolkit'
import { readStreamableValue } from '../../utils'

export function AskButton({ ask, ...props }: { ask: () => void } & ButtonProps) {
    return (
        <Button
            startContent={<StudentIcon weight='fill' size={20} />}
            color='primary'
            {...props}
            onPress={() => {
                ask()
            }}
        >Ask AI</Button>
    )
}

export function Ask() {
    const [open, setOpen] = useAtom(openAskAtom)
    const explanationProps = useAtomValue(askParamsAtom)
    return (
        <Drawer.Root modal={true} open={open} onOpenChange={setOpen}>
            <Drawer.Portal>
                <Drawer.Content className='flex chat gap-2 p-2 h-[50vh] mt-24 fixed bottom-0 w-full sm:left-5 z-999999 sm:w-fit'>
                    <Drawer.Title className='sr-only'>AI Explanation</Drawer.Title>
                    <QuizLogo className='size-12 self-end' />
                    <div className={cn(
                        'px-4 pt-4 border-1 border-divider bg-content1/50 backdrop-blur-lg flex-1 flex flex-col items-center overflow-y-auto',
                        'rounded-3xl rounded-bl-none mb-2',
                    )}>
                        <div className='prose dark:prose-invert'>
                            {explanationProps && <Explanation {...explanationProps} />}
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}

async function* streamExplanation(props: StreamExplanationParams) {
    try {
        const result = await streamExplanationAction(props)
        if ('partialObjectStream' in result) {
            for await (const chunk of readStreamableValue(result.partialObjectStream)) {
                yield chunk
            }
        }
        else {
            yield result
        }
    } catch (error) {
        toast.error('AI 输出中止，请重试')
        console.error(error)
    }
}

function Explanation(props: StreamExplanationParams) {
    const setHighlights = useSetAtom(highlightsAtom)
    const { scrollTo } = useScrollToMatch()

    const { data: explanation } = useQuery(queryOptions({
        queryKey: ['ask', hashAskParams(props)],
        queryFn: streamedQuery<{
            explanation?: string
            highlights?: (string | undefined)[]
        }>({
            streamFn: () => streamExplanation(props)
        }),
        staleTime: Infinity,
        enabled: true
    }))

    const askResponseParseResult = AskResponseSchema.safeParse(explanation && last(explanation))
    const askResponse = askResponseParseResult.success ? askResponseParseResult.data : null

    const onDataChange = useEffectEvent((response: typeof askResponse) => {
        if (!response)
            return
        const highlights = response.highlights?.filter(h => h && h.length > 5)
        if (highlights) {
            setHighlights({
                [props.quizData.id]: highlights
            })
            scrollTo(highlights[0])
        }
    })

    useEffect(() => {
        if (explanation && explanation.length > 0) {
            onDataChange(askResponse)
        }
    }, [explanation])

    return (
        <div className='px-4 py-2 w-sm max-w-fit'>{
            askResponse
                ? <div className={cn('py-2')}>
                    <Streamdown className='prose-blockquote:not-italic prose-headings:mt-2 prose-blockquote:prose-p:before:content-none prose-blockquote:prose-p:after:content-none prose-code:px-0.5 prose-code:underline prose-code:underline-offset-4 prose-code:text-secondary-400'>
                        {askResponse.explanation}
                    </Streamdown>
                </div>
                : <div className='flex justify-center gap-1.5 sm:w-96 pr-4'>
                    AI is thinking <Spinner variant='dots' color='current' />
                </div>
        }</div>
    )
}
