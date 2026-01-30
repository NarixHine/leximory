'use client'

import { Drawer } from 'vaul'
import { useRef } from 'react'
import { cn } from '@heroui/theme'
import { getBracketedSelection, useSelection } from './utils'
import { Button, Card, CardBody } from '@heroui/react'
import { Spinner } from '@heroui/spinner'
import {
    useQuery,
    queryOptions,
    experimental_streamedQuery as streamedQuery,
    useMutation
} from '@tanstack/react-query'
import { readStreamableValue } from '../utils'
import { annotateWordAction } from '@repo/service/annotate'
import { toast } from 'sonner'
import { BookmarkIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import { Streamdown } from 'streamdown'
import { saveWordAction } from '@repo/service/word'

async function* annotateWordStream(prompt: string) {
    const { data } = await annotateWordAction({ prompt })
    if (!data) {
        throw new Error('No data received from annotation service')
    }
    const { annotation, error } = data
    if (error) {
        toast.error(error, {
            duration: 10000,
        })
        throw new Error(error)
    }
    if (annotation) {
        try {
            let mergedAnnotation = ''
            for await (const delta of readStreamableValue(annotation)) {
                mergedAnnotation += delta
                yield mergedAnnotation
            }
        } catch (error) {
            console.error(error)
            toast.error('生成中止')
            throw error
        }
    }
}

const annotateQueryOptions = (prompt: string) =>
    queryOptions({
        queryKey: ['annotate-word', prompt],
        queryFn: streamedQuery({
            streamFn: () => annotateWordStream(prompt)
        }),
        staleTime: Infinity,
        enabled: prompt.length > 0
    })

const useAnnotate = ({ prompt }: { prompt: string }) => {
    const { data = [], isPending } = useQuery(annotateQueryOptions(prompt))
    const portions = data.length > 0 ? data[data.length - 1].replace('{{', '').replace('}}', '').split('||') : []
    return { portions, isPending }
}

export function Define() {
    const ref = useRef(globalThis.document)
    const selectionContext = useSelection(ref)
    const { left, width, selection } = selectionContext

    // 1. Get the bounding rectangle of the selection
    const rect = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).getBoundingClientRect() : null

    // 2. Calculate positioning
    let buttonTop = 0
    if (rect) {
        const centerY = rect.top + rect.height / 2
        const isUpperHalf = centerY < window.innerHeight / 2
        const scrollOffset = window.scrollY

        if (isUpperHalf) {
            // Position ABOVE the selection
            // rect.top is the top of the text, subtract ~50px for button height + margin
            buttonTop = scrollOffset + rect.top - 50
        } else {
            // Position BELOW the selection
            // rect.bottom is the bottom of the text, add ~10px margin
            buttonTop = scrollOffset + rect.bottom + 10
        }
    }

    return (
        <Drawer.Root repositionInputs={false}>
            {selection && selection.anchorNode?.textContent && selection.toString() && left && width && rect && (
                <Drawer.Trigger asChild>
                    <Button
                        style={{
                            left: left + width / 2,
                            top: buttonTop
                        }}
                        className={cn(
                            'absolute -translate-x-1/2 z-50 flex h-10 shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full',
                        )}
                        color='primary'
                        startContent={<MagnifyingGlassIcon weight='duotone' />}
                        variant='shadow'
                    >
                        Define
                    </Button>
                </Drawer.Trigger>
            )}
            <Drawer.Portal>
                <Drawer.Overlay className={cn(
                    'fixed inset-0 z-60',
                    'bg-linear-to-t to-transparent from-default-900/40 dark:from-stone-950/60',
                )} />
                <Drawer.Content className='h-fit px-2 fixed rounded-t-xl bottom-3 left-0 right-0 outline-none z-70 flex flex-col justify-center items-center mx-auto max-w-lg'>
                    <Drawer.Title className='sr-only'>词汇注解</Drawer.Title>
                    {selection && <Annotation prompt={getBracketedSelection(selection)} />}
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}

function Annotation({ prompt }: { prompt: string }) {
    const { portions, isPending } = useAnnotate({ prompt })
    return (
        <Card fullWidth radius='sm' shadow='none'>
            <CardBody className={cn('pt-3 pb-4 px-5 leading-snug gap-2')}>
                <div className={'font-bold text-lg'}>{portions[1] ?? portions[0]}</div>
                <div className='overflow-hidden'>
                    <div>
                        {
                            isPending && portions.length === 0
                                ? <div className='flex font-mono items-center gap-1.5'>
                                    Generating <Spinner variant='dots' color='default' />
                                </div>
                                : <></>
                        }
                    </div>
                    {portions[2] && <div>
                        <div className='font-semibold text-sm'>释义</div>
                        <Streamdown>{portions[2]}</Streamdown>
                    </div>}
                    {portions[3] && <div className={'mt-2'}>
                        <div className='font-semibold text-sm'>语源</div>
                        <Streamdown>{portions[3]}</Streamdown>
                    </div>}
                    {portions[4] && <div className={'mt-2'}>
                        <div className='font-semibold text-sm'>同源词</div>
                        <Streamdown>{portions[4]}</Streamdown>
                    </div>}
                </div>
                <div>
                    {portions[2] && <Save portions={portions} />}
                </div>
            </CardBody>
        </Card>
    )
}

function Save({ portions }: { portions: string[] }) {
    const { mutate, isPending, isSuccess } = useMutation({
        mutationFn: async () => {
            await saveWordAction({ portions })
        },
    })
    return (
        <Button
            color='secondary'
            isLoading={isPending}
            startContent={<BookmarkIcon weight='duotone' />}
            isDisabled={isSuccess}
            onPress={() => {
                mutate()
            }}
        >
            {isSuccess ? '已保存' : '保存'}
        </Button>
    )
}

export * from './utils'
