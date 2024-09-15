'use client'

import Markdown from '@/components/markdown'
import { welcomeMap } from '@/lib/config'
import { LexiconRecord } from '@/lib/xata'
import { Button } from '@nextui-org/button'
import moment from 'moment'
import { Fragment, useState, useTransition } from 'react'
import { PiArrowsHorizontalDuotone } from 'react-icons/pi'
import load from './actions'
import { useAtomValue } from 'jotai'
import { libAtom, isReadOnlyAtom } from '../atoms'
import { Chip } from '@nextui-org/chip'

export default function Recollection({ words, cursor, more }: {
    words: { word: string, id: string, xata: LexiconRecord['xata'], lib: { id: string, name: string } }[]
    cursor: string
    more: boolean
}) {
    const lib = useAtomValue(libAtom)
    const isReadOnly = useAtomValue(isReadOnlyAtom)

    const [recol, setRecol] = useState<typeof words>([] satisfies typeof words)
    const [newCursor, setNewCursor] = useState(cursor)
    const [moreWords, setMoreWords] = useState(more)
    const [isPending, startTransition] = useTransition()
    return (<div className='grid lg:grid-cols-4 md:grid-cols-3 grid-cols-2 gap-3 w-full'>
        {words.concat(recol).map(({ word, id, xata }, index, array) => {
            moment().utcOffset('+08:00')
            const anotherDay = array[index + 1] && !moment(xata.createdAt).isSame(array[index + 1].xata.createdAt, 'day')
            return <Fragment key={id}>
                <div className='w-full min-h-20 h-full flex flex-col justify-center items-center'>
                    <Markdown md={word} deleteId={isReadOnly || Object.values(welcomeMap).includes(word) ? undefined : id} disableSave></Markdown>
                </div>
                {anotherDay && <div className='w-full min-h-20 h-full flex flex-col justify-center items-center'>
                    <Chip size='lg' variant='flat' color='secondary'>
                        {moment(array[index + 1].xata.createdAt).startOf('day').format('ll')}
                    </Chip>
                </div>}
            </Fragment>
        })}
        {moreWords && <div className='w-full min-h-20 h-full flex flex-col justify-center items-center'>
            <Button onPress={async () => {
                startTransition(async () => {
                    const { words, cursor, more } = await load(lib, newCursor)
                    setRecol((prev) => prev.concat(words))
                    setNewCursor(cursor)
                    setMoreWords(more)
                })
            }} radius='full' variant='flat' color='primary' size='lg' isIconOnly startContent={!isPending && <PiArrowsHorizontalDuotone />} isLoading={isPending}></Button>
        </div>}
    </div>)
}
