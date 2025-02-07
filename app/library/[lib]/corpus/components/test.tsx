'use client'

import Markdown from '@/components/markdown'
import { welcomeMap } from '@/lib/config'
import { getLocalTimeZone, parseDate } from '@internationalized/date'
import { Button } from "@heroui/button"
import { DateRangePicker } from "@heroui/date-picker"
import { useActionState, useState, useTransition } from 'react'
import { draw, generateStory, getWithin } from '../actions'
import moment from 'moment'
import { PiMagicWandDuotone, PiShuffleAngularDuotone } from 'react-icons/pi'
import { useAtomValue } from 'jotai'
import { isReadOnlyAtom, libAtom } from '../../atoms'
import { I18nProvider } from '@react-aria/i18n'
import { ConfirmStory } from './confirm-story'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useLogSnag } from '@logsnag/next'

export default function Test({ latestTime }: {
    latestTime: string
}) {
    const lib = useAtomValue(libAtom)
    const isReadOnly = useAtomValue(isReadOnlyAtom)
    const [start, setStart] = useState(parseDate(latestTime).subtract({ days: 6 }))
    const [end, setEnd] = useState(parseDate(latestTime))
    const retrieveConfig = {
        lib,
        start: moment(start.toDate(getLocalTimeZone())).startOf('day').toDate(),
        end: moment(end.toDate(getLocalTimeZone())).add(1, 'day').startOf('day').toDate()
    }
    const [words, drawWords, isDrawing] = useActionState(() => {
        return draw(retrieveConfig)
    }, [])
    const [isGettingWithin, startGettingWithin] = useTransition()
    const router = useRouter()
    const { track } = useLogSnag()

    return <div>
        <ConfirmStory.Root></ConfirmStory.Root>
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
        <div className='flex space-x-2'>
            <div className='flex flex-col items-center justify-center flex-1 border-x-1 text-nowrap min-h-36 px-2 h-36 overflow-y-auto'>
                {words.map(({ word, id }) => (
                    !Object.values(welcomeMap).includes(word) &&
                    <Markdown md={word} deleteId={isReadOnly ? undefined : id} key={id} disableSave></Markdown>
                ))}
            </div>
            <form action={drawWords} className='flex flex-col gap-2'>
                <Button
                    size='sm'
                    variant='flat'
                    isLoading={isDrawing}
                    startContent={!isDrawing && <PiShuffleAngularDuotone className='text-xl' />}
                    color='primary'
                    type='submit'
                >
                    抽取
                </Button>
                <Button
                    size='sm'
                    variant='flat'
                    isLoading={isGettingWithin}
                    startContent={!isGettingWithin && <PiMagicWandDuotone className='text-xl' />}
                    color='secondary'
                    onPress={() => {
                        startGettingWithin(async () => {
                            const comments = await getWithin(retrieveConfig)
                            if (await ConfirmStory.call({ comments })) {
                                generateStory({ comments, lib })
                                    .then(async ({ success, error }) => {
                                        if (success) {
                                            track({
                                                channel: 'annotation',
                                                event: '生成小故事',
                                                icon: '👀',
                                                tags: {
                                                    lib,
                                                }
                                            })
                                            toast.success('生成后故事会出现在本文库文本内', {
                                                action: {
                                                    label: '设置提醒',
                                                    onClick: () => {
                                                        router.push(`/daily`)
                                                    }
                                                }
                                            })
                                        } else {
                                            toast.error(error)
                                        }
                                    })
                            }
                        })
                    }}
                >
                    故事
                </Button>
            </form>
        </div>
    </div>
}
