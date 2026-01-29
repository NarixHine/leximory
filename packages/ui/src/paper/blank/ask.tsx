'use client'

import { Drawer } from 'vaul'
import { useMutation } from '@tanstack/react-query'
import { Streamdown } from 'streamdown'
import { Spinner } from '@heroui/spinner'
import { streamExplanationAction } from '@repo/service/paper'
import { cn } from '@heroui/theme'
import { useEffectEvent, useEffect, useState } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { askParamsAtom, highlightsAtom, openAskAtom } from './atoms'
import { AskResponseSchema } from '@repo/schema/paper'
import { StreamExplanationParams } from '@repo/service/paper'
import { toast } from 'sonner'
import { Button, ButtonProps } from '@heroui/button'
import { StudentIcon } from '@phosphor-icons/react'
import { useScrollToMatch } from './hooks'

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
                <Drawer.Content className='flex flex-col h-[50vh] mt-24 fixed bottom-0 w-full sm:left-0 z-999999 sm:w-fit px-3'>
                    <Drawer.Title className='sr-only'>AI Explanation</Drawer.Title>
                    <div className='p-4 bg-default-50 rounded-t-xl flex-1 flex flex-col items-center overflow-y-auto shadow-lg'>
                        <div aria-hidden className='mx-auto w-12 h-1.5 shrink-0 rounded-full bg-default-300' />
                        <div className='prose dark:prose-invert'>
                            {explanationProps && <Explanation {...explanationProps} />}
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}

function Explanation({ quizData, questionNo, userAnswer }: StreamExplanationParams) {
    const setHighlights = useSetAtom(highlightsAtom)
    const { scrollTo } = useScrollToMatch()
    const [explanationData, setExplanationData] = useState<any[]>([])

    const { mutate: fetchExplanation } = useMutation({
        mutationFn: async () => {
            try {
                const result = await streamExplanationAction({ quizData, questionNo, userAnswer })
                let accumulated: any[] = []
                if ('partialObjectStream' in result && Symbol.asyncIterator in result.partialObjectStream) {
                    for await (const chunk of result.partialObjectStream) {
                        accumulated.push(chunk)
                        setExplanationData([...accumulated])
                    }
                }
                accumulated.push(result.object)
            } catch {
                toast.error('AI 输出中止，请重试')
            }
        },
        retry: 1
    })

    const askResponseParseResult = explanationData.length > 0 ? AskResponseSchema.safeParse(explanationData[explanationData.length - 1]) : null
    const askResponse = askResponseParseResult?.success ? askResponseParseResult.data : null

    const onDataChange = useEffectEvent((response: typeof askResponse) => {
        if (!response)
            return
        const highlights = response.highlights?.filter(h => h && h.length > 5)
        if (highlights) {
            setHighlights({
                [quizData.id]: highlights
            })
            scrollTo(highlights[0])
        }
    })

    useEffect(() => {
        fetchExplanation()
    }, [quizData.id, questionNo, userAnswer])

    useEffect(() => {
        if (explanationData.length > 0) {
            onDataChange(explanationData.findLast(d => AskResponseSchema.safeParse(d).success) as typeof askResponse)
        }
    }, [explanationData])

    return (
        <div className='px-4 py-2'>{
            explanationData.length > 0
                ? <div className={cn('py-2 w-sm')}>
                    <Streamdown className='prose-blockquote:not-italic prose-blockquote:prose-p:before:content-none prose-blockquote:prose-p:after:content-non prose-code:px-0.5 prose-code:underline prose-code:underline-offset-4 prose-code:text-secondary-400'>
                        {askResponse?.explanation}
                    </Streamdown>
                </div>
                : <div className='flex justify-center gap-1.5 w-sm'>
                    AI is thinking <Spinner variant='dots' color='current' />
                </div>
        }</div>
    )
}
