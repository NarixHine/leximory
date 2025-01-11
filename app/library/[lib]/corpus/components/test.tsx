'use client'

import Markdown from '@/components/markdown'
import { welcomeMap } from '@/lib/config'
import { getLocalTimeZone, parseDate } from '@internationalized/date'
import { Button } from '@nextui-org/button'
import { DateRangePicker } from '@nextui-org/date-picker'
import { useActionState, useState } from 'react'
import { draw } from '../actions'
import moment from 'moment'
import { PiShuffleAngularDuotone } from 'react-icons/pi'
import { useAtomValue } from 'jotai'
import { isReadOnlyAtom, libAtom } from '../../atoms'
import { I18nProvider } from '@react-aria/i18n'

export default function Test({ latestTime }: {
    latestTime: string
}) {
    const lib = useAtomValue(libAtom)
    const isReadOnly = useAtomValue(isReadOnlyAtom)
    const [start, setStart] = useState(parseDate(latestTime).subtract({ days: 6 }))
    const [end, setEnd] = useState(parseDate(latestTime))
    const [words, drawWords, isDrawing] = useActionState(() => {
        return draw(lib, moment(start.toDate(getLocalTimeZone())).startOf('day').toDate(), moment(end.toDate(getLocalTimeZone())).add(1, 'day').startOf('day').toDate())
    }, [])

    return <div>
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
            <form action={drawWords}>
                <Button
                    data-umami-event='抽取词汇'
                    size='sm'
                    variant='flat'
                    isLoading={isDrawing}
                    startContent={!isDrawing && <PiShuffleAngularDuotone className='text-xl' />}
                    color='primary'
                    type='submit'
                >
                    抽取
                </Button>
            </form>
        </div>
    </div>
}
