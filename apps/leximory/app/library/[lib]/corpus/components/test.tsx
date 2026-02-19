'use client'

import Markdown from '@/components/markdown'
import { languageStrategies } from '@/lib/languages'
import { getLocalTimeZone, parseDate } from '@internationalized/date'
import { Button } from "@heroui/button"
import { DateRangePicker } from "@heroui/date-picker"
import { Suspense, useActionState, useState, useTransition } from 'react'
import { draw, generateStory, getWithin } from '../actions'
import { luxon } from '@/lib/luxon'
import { PiListMagnifyingGlassDuotone, PiMagicWandDuotone } from 'react-icons/pi'
import { useAtomValue } from 'jotai'
import { isReadOnlyAtom, libAtom } from '../../atoms'
import { I18nProvider } from '@react-aria/i18n'
import { ConfirmStory } from './confirm-story'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

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
    const [words, drawWords, isDrawing] = useActionState(() => {
        return draw(retrieveConfig)
    }, [])
    const [isGettingWithin, startGettingWithin] = useTransition()
    const router = useRouter()

    return <div className='flex gap-2'>
        <div className='flex flex-col items-center justify-center flex-1 rounded-2xl bg-default-50 text-nowrap min-h-36 px-3 h-36 overflow-y-auto'>
            {words.map(({ word, id }) => (
                !languageStrategies.map(s => s.welcome).includes(word) &&
                <Markdown md={word} deleteId={isReadOnly ? undefined : id} key={id} disableSave />
            ))}
        </div>
        <form action={drawWords} className='flex flex-col gap-2'>
            <Button
                size='sm'
                variant='flat'
                isLoading={isDrawing}
                startContent={!isDrawing && <PiListMagnifyingGlassDuotone className='text-xl' />}
                color='default'
                type='submit'
            >
                所有
            </Button>
            {!isReadOnly && <Button
                size='sm'
                variant='flat'
                isLoading={isGettingWithin}
                startContent={!isGettingWithin && <PiMagicWandDuotone className='text-xl' />}
                color='default'
                onPress={() => {
                    startGettingWithin(async () => {
                        const comments = await getWithin(retrieveConfig)
                        if (await ConfirmStory.call({ comments })) {
                            generateStory({ comments, lib })
                                .then(async ({ success, message }) => {
                                    if (success) {
                                        toast.success(message, {
                                            action: {
                                                label: '设置提醒',
                                                onClick: () => {
                                                    router.push(`/daily`)
                                                }
                                            }
                                        })
                                    } else {
                                        toast.error(message)
                                    }
                                })
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
        <ConfirmStory.Root />
        <Suspense>
            <I18nProvider locale='zh-CN'>
            <DateRangePicker
                className='my-3'
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
                color='default'
            />
        </I18nProvider>
        </Suspense>
        <Suspense fallback={<div className='flex gap-2'>
            <div className='flex flex-col items-center justify-center flex-1 rounded-2xl bg-default-50 text-nowrap min-h-36 px-3 h-36'>
                <span className='text-default-300 text-sm'>加载中…</span>
            </div>
            <div className='flex flex-col gap-2'>
                <Button size='sm' variant='flat' color='default' isLoading>所有</Button>
                {!isReadOnly && <Button size='sm' variant='flat' color='default' isLoading>故事</Button>}
            </div>
        </div>}>
            <ConfigDependent start={start} end={end} lib={lib} isReadOnly={isReadOnly} />
        </Suspense>
    </div>
}
