'use client'

import { Button, Input } from '@nextui-org/react'
import { save } from './actions'
import { useState, useTransition } from 'react'
import { PiFloppyDiskBackDuotone, PiMagnifyingGlassDuotone } from 'react-icons/pi'
import Comment from '@/components/comment'
import { useAtomValue } from 'jotai'
import { libAtom, isReadOnlyAtom, langAtom } from '../atoms'

export default function Save({ compact }: { compact?: boolean }) {
    const lib = useAtomValue(libAtom)
    const isReadOnly = useAtomValue(isReadOnlyAtom)
    const isEnglish = useAtomValue(langAtom) === 'en'

    const [input, setInput] = useState('')
    const [pending, startTransition] = useTransition()

    return <div className='my-2'>
        {!compact && <h2 className='text-xl'>保存外部生词</h2>}
        <div className='flex space-x-2'>
            <Input name={'word'} value={input} onValueChange={setInput} variant='underlined' size='sm' label={compact ? '手动输入词汇' : '输入词汇'} className='flex-1'></Input>
            <div className='flex flex-col-reverse'>
                <div className='flex space-x-2'>
                    {isEnglish && <Comment
                        params={`[\"${input}\"]`}
                        trigger={{
                            size: 'sm',
                            isIconOnly: true,
                            variant: 'flat',
                            startContent: <PiMagnifyingGlassDuotone />,
                            color: 'primary'
                        }}
                    ></Comment>}
                    {!isReadOnly && <Button onPress={async () => {
                        startTransition(async () => {
                            await save(lib, input)
                            setInput('')
                        })
                    }} isLoading={pending} size='sm' variant='flat' color='primary' startContent={<PiFloppyDiskBackDuotone />} isIconOnly></Button>}
                </div>
            </div>
        </div>
    </div>
}
