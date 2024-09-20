'use client'

import Markdown from '@/components/markdown'
import { welcomeMap } from '@/lib/config'
import { LexiconRecord } from '@/lib/xata'
import { getLocalTimeZone, parseDate } from '@internationalized/date'
import { Button, DateRangePicker } from '@nextui-org/react'
import { SelectedPick, PageRecordArray } from '@xata.io/client'
import { useState } from 'react'
import { draw } from './actions'
import moment from 'moment'
import { PiShuffleAngularDuotone } from 'react-icons/pi'
import { useAtomValue } from 'jotai'
import { isReadOnlyAtom, libAtom } from '../atoms'
import { I18nProvider } from '@react-aria/i18n'

export default function Test({ latestTime, compact }: {
    latestTime: string
    compact?: boolean
}) {
    const lib = useAtomValue(libAtom)
    const disableDel = useAtomValue(isReadOnlyAtom)

    const [words, setWords] = useState<PageRecordArray<SelectedPick<LexiconRecord, 'word'[]>> | []>([])
    const [start, setStart] = useState(parseDate(latestTime).subtract({ days: 6 }))
    const [end, setEnd] = useState(parseDate(latestTime))
    return <div>
        {!compact && <h2 className='text-xl'>自我检测</h2>}
        <I18nProvider locale='zh-CN'>
            <DateRangePicker
                className='my-2'
                label='词汇选取范围'
                granularity='day'
                value={{ start, end }}
                onChange={({ start, end }) => {
                    setStart(start)
                    setEnd(end)
                }}
                variant='underlined'
                color='primary'
                isReadOnly={compact}
            ></DateRangePicker>
        </I18nProvider>
        <div className='flex space-x-2'>
            <div className='flex flex-col items-center justify-center flex-1 border-x-1 text-nowrap space-x-2 min-h-36 px-1'>
                {
                    words.map(({ word, id }) => (
                        !Object.values(welcomeMap).includes(word) && <Markdown key={word} md={word} deleteId={disableDel ? undefined : id} disableSave></Markdown>
                    ))
                }
            </div>
            <Button data-umami-event='抽取词汇' size='sm' variant='flat' startContent={<PiShuffleAngularDuotone />} color='primary' onPress={async () => {
                const words = await draw(lib, moment(start.toDate(getLocalTimeZone())).startOf('day').toDate(), moment(end.toDate(getLocalTimeZone())).add(1, 'day').startOf('day').toDate())
                setWords(words)
            }}>{'抽取'}</Button>
        </div>
    </div>
}
