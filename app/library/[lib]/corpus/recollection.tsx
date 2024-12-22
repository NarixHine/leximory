'use client'

import Markdown from '@/components/markdown'
import { welcomeMap } from '@/lib/config'
import moment from 'moment'
import { Fragment, useActionState, useState, useTransition } from 'react'
import { PiArrowsHorizontalDuotone } from 'react-icons/pi'
import load from './actions'
import { useAtomValue } from 'jotai'
import { libAtom, isReadOnlyAtom } from '../atoms'
import { Button } from '@nextui-org/button'
import { Chip } from '@nextui-org/chip'

export default function Recollection({ words, cursor, more }: {
    words: { word: string, id: string, date: string, lib: { id: string, name: string } }[]
    cursor: string
    more: boolean
}) {
    const lib = useAtomValue(libAtom)
    const isReadOnly = useAtomValue(isReadOnlyAtom)

    const [recol, loadRecol, isLoading] = useActionState(async (recol: { words: typeof words, cursor: string, more: boolean }) => {
        const { words, cursor, more } = await load(lib, recol.cursor)
        return { words: recol.words.concat(words), cursor, more }
    }, { words, cursor, more })
    
    return (<div className='grid lg:grid-cols-4 md:grid-cols-3 grid-cols-2 gap-3 w-full'>
        {recol.words.map(({ word, id, date }, index, array) => {
            const anotherDay = array[index + 1] && !moment(date).isSame(array[index + 1].date, 'day')
            return <Fragment key={id}>
                <div className='w-full min-h-20 h-full flex flex-col justify-center items-center'>
                    <Markdown md={word} deleteId={isReadOnly || Object.values(welcomeMap).includes(word) ? undefined : id} disableSave></Markdown>
                </div>
                {anotherDay && <div className='w-full min-h-20 h-full flex flex-col justify-center items-center'>
                    <Chip size='lg' variant='flat' color='secondary'>
                        {moment(array[index + 1].date).startOf('day').format('ll')}
                    </Chip>
                </div>}
            </Fragment>
        })}
        {recol.more && <form action={loadRecol} className='w-full min-h-20 h-full flex flex-col justify-center items-center'>
            <Button type='submit' radius='full' variant='flat' color='primary' size='lg' isIconOnly startContent={!isLoading && <PiArrowsHorizontalDuotone />} isLoading={isLoading}></Button>
        </form>}
    </div>)
}
