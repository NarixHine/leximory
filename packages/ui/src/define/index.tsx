'use client'

import { Drawer } from 'vaul'
import { useRef, useState } from 'react'
import { cn } from '@heroui/theme'
import { useSelection } from './utils'
import { Button, Card, CardBody, Spacer } from '@heroui/react'
import { Spinner } from '@heroui/spinner'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { readStreamableValue } from '../utils'
import { annotateWordAction } from '@repo/service/annotate'
import { toast } from 'sonner'
import { prefixUrl } from '@repo/env/config'
import { MagnifyingGlassIcon } from '@phosphor-icons/react'

const useAnnotate = () => {
    const [portions, setPortions] = useState<string[]>([])
    const router = useRouter()
    const { mutate: commentWord, isPending } = useMutation({
        mutationFn: async (prompt: string) => {
            const { text, error } = await annotateWordAction({ text: prompt })
            if (error) {
                toast.error(error, {
                    duration: 10000,
                    action: {
                        label: '升级',
                        onClick: () => router.push(prefixUrl('/settings'))
                    }
                })
                throw new Error(error)
            }
            if (text) {
                try {
                    let commentary = ''
                    for await (const delta of readStreamableValue(text)) {
                        commentary += delta
                        setPortions(commentary.replaceAll('{', '').replaceAll('}', '').split('||'))
                    }
                } catch (error) {
                    console.error(error)
                    toast.error('生成中止')
                }
            }
        },
        retry: 1
    })

    return { commentWord, portions, isPending }
}

export function Define() {
    const ref = useRef(globalThis.document)
    const selectionContext = useSelection(ref)
    const { left, width, selection } = selectionContext
    const [open, setOpen] = useState(false)
    const { commentWord, portions, isPending } = useAnnotate()

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
        <Drawer.Root repositionInputs={false} open={open} onOpenChange={setOpen}>
            {selection && selection.anchorNode?.textContent && selection.toString() && left && width && rect && (
                <Drawer.Trigger
                    style={{
                        left: left + width / 2,
                        top: buttonTop
                    }}
                    className={cn(
                        'absolute -translate-x-1/2 z-50 flex h-10 shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full bg-white border border-default-100 px-4 text-sm font-medium shadow-sm transition-all hover:bg-[#FAFAFA] dark:bg-[#161615] dark:hover:bg-[#1A1A19] dark:text-white',
                    )}
                >
                    <Button startContent={<MagnifyingGlassIcon />} variant='light' onPress={() => {
                        commentWord(selection.toString())
                        setOpen(true)
                    }}>
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
                    <Card fullWidth radius='sm' shadow='none'>
                        <CardBody className={cn('px-3 pb-2.5 pt-1.5 leading-snug font-formal')}>
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
                                {portions[2] && <><Spacer y={3} /></>}
                            </div>
                        </CardBody>
                    </Card>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}

export * from './utils'
