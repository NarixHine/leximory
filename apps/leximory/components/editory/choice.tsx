'use client'

import { Button } from '@heroui/react'
import { useSetAtom, useAtomValue } from 'jotai'
import { setAnswerAtomFamily, getAnswerAtomFamily } from './atoms'
import { ALPHABET_SET } from './generators/config'

const Choice = ({ number, options, groupId }: { number: number, options: string[], groupId: string }) => {
    const setAnswer = useSetAtom(setAnswerAtomFamily(groupId))
    const getAnswer = useAtomValue(getAnswerAtomFamily(groupId))
    const answer = getAnswer(number)

    return <div className='pb-2 flex flex-col gap-2'>
        {options.map((option, index) => (
            <div key={index} className='flex items-center gap-2'>
                <Button
                    color={answer === ALPHABET_SET[index] ? 'secondary' : 'default'}
                    variant={answer === ALPHABET_SET[index] ? 'solid' : 'ghost'}
                    size='sm'
                    className='font-mono'
                    radius='full'
                    isIconOnly
                    startContent={<span className='font-mono'>{ALPHABET_SET[index]}</span>}
                    onPress={() => {
                        setAnswer({ questionId: number, option: ALPHABET_SET[index] })
                    }}
                ></Button>
                <span>
                    {option}
                </span>
            </div>
        ))}
    </div>
}

export default Choice
