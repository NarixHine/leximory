'use client'

import { Popover, PopoverTrigger, PopoverContent, Button } from '@heroui/react'
import { useSetAtom, useAtomValue } from 'jotai'
import { PiCursorClickFill, PiCursorClick } from 'react-icons/pi'
import { setAnswerAtomFamily, getAnswerAtomFamily } from './atoms'
import { ALPHABET_SET } from './generators/config'

const Blank = ({ number, options, groupId }: { number: number, spaceCount?: number, options?: string[], groupId: string }) => {
    const setAnswer = useSetAtom(setAnswerAtomFamily(groupId))
    const getAnswer = useAtomValue(getAnswerAtomFamily(groupId))
    const answer = getAnswer(number)
    const spaces = '\u00A0'
    const ShownBlank = <u className='whitespace-nowrap'>{answer ? <PiCursorClickFill className='inline ml-2 -mr-6 mb-1' /> : <PiCursorClick className='inline ml-2 -mr-6 mb-1' />}{`${spaces.repeat(6)}${number}${spaces.repeat(3)}`}</u>

    if (options && options.length > 0) {
        return (
            <Popover>
                <PopoverTrigger>
                    {ShownBlank}
                </PopoverTrigger>
                <PopoverContent>
                    <div className='p-2 font-mono grid grid-cols-1 sm:grid-cols-2 gap-2'>
                        {options.map((option, index) => (
                            <Button
                                key={index}
                                color={answer === option ? 'secondary' : 'default'}
                                variant='flat'
                                size='sm'
                                onPress={() => setAnswer({ questionId: number, option })}
                            >
                                {`${ALPHABET_SET[index]}. ${option}`}
                            </Button>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        )
    }
    return ShownBlank
}

export default Blank
