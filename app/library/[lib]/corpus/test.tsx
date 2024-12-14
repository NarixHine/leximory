'use client'

import Markdown from '@/components/markdown'
import { welcomeMap } from '@/lib/config'
import { LexiconRecord } from '@/lib/xata'
import { getLocalTimeZone, parseDate } from '@internationalized/date'
import { Button } from '@nextui-org/button'
import { DateRangePicker } from '@nextui-org/date-picker'
import { SelectedPick, PageRecordArray } from '@xata.io/client'
import { useState, useTransition } from 'react'
import { draw } from './actions'
import moment from 'moment'
import { PiShuffleAngularDuotone } from 'react-icons/pi'
import { useAtomValue } from 'jotai'
import { isReadOnlyAtom, libAtom } from '../atoms'
import { I18nProvider } from '@react-aria/i18n'
import { motion, AnimatePresence } from 'framer-motion'

export default function Test({ latestTime }: {
    latestTime: string
}) {
    const lib = useAtomValue(libAtom)
    const isReadOnly = useAtomValue(isReadOnlyAtom)

    const [words, setWords] = useState<{ word: string, id: string }[]>([])
    const [start, setStart] = useState(parseDate(latestTime).subtract({ days: 6 }))
    const [end, setEnd] = useState(parseDate(latestTime))
    const [isLoading, startTransition] = useTransition()

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
            <div className='flex flex-col items-center justify-center flex-1 border-x-1 text-nowrap min-h-36 px-2'>
                <AnimatePresence mode='sync'>
                    {words.map(({ word, id }) => (
                        !Object.values(welcomeMap).includes(word) &&
                        <motion.div
                            key={word}
                            initial={{ opacity: 0, scale: 0.8, x: 20 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.8, x: -20 }}
                            transition={{ duration: 0.5 }}
                        >
                            <Markdown md={word} deleteId={isReadOnly ? undefined : id} disableSave></Markdown>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
            <Button
                data-umami-event='抽取词汇'
                size='sm'
                variant='flat'
                isLoading={isLoading}
                startContent={!isLoading && <PiShuffleAngularDuotone />}
                color='primary'
                onPress={() => { 
                    setWords([])
                    startTransition(async () => {
                        const words = await draw(lib, moment(start.toDate(getLocalTimeZone())).startOf('day').toDate(), moment(end.toDate(getLocalTimeZone())).add(1, 'day').startOf('day').toDate())
                        setWords(words)
                    })
                }}
            >
                {'抽取'}
            </Button>
        </div>
    </div>
}
