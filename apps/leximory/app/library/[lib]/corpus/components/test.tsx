'use client'

import Markdown from '@/components/markdown'
import { languageStrategies } from '@/lib/languages'
import { getLocalTimeZone, parseDate } from '@internationalized/date'
import { Button } from "@heroui/button"
import { DateRangePicker } from "@heroui/date-picker"
import { Suspense, useState, useTransition } from 'react'
import { drawCorpusAction, generateStoryAction, getWithinCorpusAction } from '../actions'
import { luxon } from '@/lib/luxon'
import { PiListMagnifyingGlassDuotone, PiMagicWandDuotone } from 'react-icons/pi'
import { useAtomValue } from 'jotai'
import { isReadOnlyAtom, libAtom } from '../../atoms'
import { I18nProvider } from '@react-aria/i18n'
import { ConfirmStory } from './confirm-story'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useAction } from '@repo/service'

function ConfigDependent({ start, end, lib, isReadOnly }: {
    start: any
    end: any
    lib: string
    isReadOnly: boolean
}) {
    const retrieveConfig = {
        lib,
        start: luxon(start.toDate(getLocalTimeZone())).startOf('day').toJSDate(),
        end: luxon(end.toDate(getLocalTimeZone())).plus({ days: 1 }).startOf('day').toJSDate()
    }
    const [words, setWords] = useState<{ word: string, id: string }[]>([])
    const { execute: drawWordsAction, isPending: isDrawing } = useAction(drawCorpusAction, {
        onSuccess: ({ data }) => setWords(data ?? []),
        onError: ({ error }) => toast.error(error.serverError ?? '加载失败'),
    })
    const { execute: getWithinAction } = useAction(getWithinCorpusAction)
    const { execute: generateStoryActionExecute } = useAction(generateStoryAction, {
        onError: ({ error }) => toast.error(error.serverError ?? '生成失败'),
    })
    const [isGettingWithin, startGettingWithin] = useTransition()
    const router = useRouter()

    return <div className='flex space-x-2'>
        <div className='flex flex-col items-center justify-center flex-1 border-x border-x-default-200 text-nowrap min-h-36 px-2 h-36 overflow-y-auto'>
            {words.map(({ word, id }) => (
                !languageStrategies.map(s => s.welcome).includes(word) &&
                <Markdown md={word} deleteId={isReadOnly ? undefined : id} key={id} disableSave></Markdown>
            ))}
        </div>
        <form
            className='flex flex-col gap-2'
            onSubmit={(e) => {
                e.preventDefault()
                drawWordsAction(retrieveConfig)
            }}>
            <Button
                size='sm'
                variant='flat'
                isLoading={isDrawing}
                startContent={!isDrawing && <PiListMagnifyingGlassDuotone className='text-xl' />}
                color='primary'
                onPress={() => drawWordsAction(retrieveConfig)}
            >
                所有
            </Button>
            {!isReadOnly && <Button
                size='sm'
                variant='flat'
                isLoading={isGettingWithin}
                startContent={!isGettingWithin && <PiMagicWandDuotone className='text-xl' />}
                color='secondary'
                onPress={() => {
                    startGettingWithin(async () => {
                        const result = await getWithinAction(retrieveConfig)
                        const comments = result?.data ?? []
                        if (await ConfirmStory.call({ comments })) {
                            const storyResult = await generateStoryActionExecute({ comments, lib })
                            if (storyResult?.data?.success) {
                                toast.success(storyResult.data.message, {
                                    action: {
                                        label: '设置提醒',
                                        onClick: () => {
                                            router.push(`/daily`)
                                        }
                                    }
                                })
                            } else {
                                toast.error(storyResult?.data?.message ?? storyResult?.serverError ?? '生成失败')
                            }
                        }
                    })
                }}
            >
                故事
            </Button>}
        </form>
    </div>
}

export default function Test({ latestTime }: {
    latestTime: string
}) {
    const lib = useAtomValue(libAtom)
    const isReadOnly = useAtomValue(isReadOnlyAtom)
    const [start, setStart] = useState(parseDate(latestTime).subtract({ days: 6 }))
    const [end, setEnd] = useState(parseDate(latestTime))

    return <div>
        <ConfirmStory.Root></ConfirmStory.Root>
        <Suspense>
            <I18nProvider locale='zh-CN'>
            <DateRangePicker
                className='my-2'
                label='词汇选取范围'
                granularity='day'
                value={{ start, end }}
                onChange={(range) => {
                    if (range) {
                        const { start, end } = range
                        setStart(start)
                        setEnd(end)
                    }
                }}
                variant='underlined'
                color='primary'
            ></DateRangePicker>
        </I18nProvider>
        </Suspense>
        <Suspense fallback={<div className='flex space-x-2'>
            <div className='flex flex-col items-center justify-center flex-1 border-x border-x-default-200 text-nowrap min-h-36 px-2 h-36 overflow-y-auto'>
                Loading words...
            </div>
            <div className='flex flex-col gap-2'>
                <Button size='sm' variant='flat' color='primary' isLoading>所有</Button>
                {!isReadOnly && <Button size='sm' variant='flat' color='secondary' isLoading>故事</Button>}
            </div>
        </div>}>
            <ConfigDependent start={start} end={end} lib={lib} isReadOnly={isReadOnly} />
        </Suspense>
    </div>
}
