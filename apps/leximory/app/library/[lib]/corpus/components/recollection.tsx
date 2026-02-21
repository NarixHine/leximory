'use client'

import Markdown from '@/components/markdown'
import { languageStrategies } from '@/lib/languages'
import moment from 'moment'
import { Fragment, useActionState } from 'react'
import { PiCaretRight } from 'react-icons/pi'
import { useAtomValue } from 'jotai'
import { libAtom, isReadOnlyAtom } from '../../atoms'
import { Button } from "@heroui/button"
import { momentSH } from '@/lib/moment'
import { load } from '@/service/corpus'

export default function Recollection({ words, cursor, more }: {
    words: { word: string, id: string, date: string }[]
    cursor: string
    more: boolean
}) {
    const lib = useAtomValue(libAtom)
    const isReadOnly = useAtomValue(isReadOnlyAtom)

    const welcomes = languageStrategies.map(s => s.welcome)

    const [recol, loadRecol, isLoading] = useActionState(async (recol: { words: typeof words, cursor: string, more: boolean }) => {
        const { words, cursor, more } = await load(lib, recol.cursor)
        return { words: recol.words.concat(words), cursor, more }
    }, { words, cursor, more })

    return (<div>
        {/* Date chip for the first group */}
        {recol.words.length > 0 && (
            <div className='mb-4'>
                <span className='text-xs font-semibold tracking-widest px-4 text-default-400'>
                    {momentSH(recol.words[0].date).startOf('day').format('ll')}
                </span>
            </div>
        )}

        <div className='grid lg:grid-cols-4 md:grid-cols-3 grid-cols-2 gap-3 w-full'>
            {recol.words.map(({ word, id, date }, index, array) => {
                const anotherDay = array[index + 1] && !moment(date).isSame(array[index + 1].date, 'day')
                return <Fragment key={id}>
                    <div className='w-full min-h-20 h-full flex flex-col justify-center items-center rounded-2xl bg-default-50 p-3 transition-colors hover:bg-default-100/50'>
                        <Markdown md={word} disableSave={welcomes.includes(word)} deleteId={isReadOnly || welcomes.includes(word) ? undefined : id} />
                    </div>
                    {anotherDay && <div className='w-full py-3 flex flex-col px-4 col-span-full'>
                        <span className='text-xs font-semibold tracking-widest text-default-400'>
                            {momentSH(array[index + 1].date).startOf('day').format('ll')}
                        </span>
                    </div>}
                </Fragment>
            })}
        </div>

        {recol.more && <form action={loadRecol} className='flex justify-center mt-8'>
            <Button
                type='submit'
                radius='full'
                variant='flat'
                color='default'
                size='lg'
                isIconOnly
                startContent={!isLoading && <PiCaretRight />}
                isLoading={isLoading}
            />
        </form>}
    </div>)
}
