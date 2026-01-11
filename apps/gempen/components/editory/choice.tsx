'use client'

import { Button, Chip } from '@heroui/react'
import { useSetAtom, useAtomValue } from 'jotai'
import { viewModeAtom, submittedAnswersAtom, setAnswerAtom, answersAtom } from './atoms'
import { ALPHABET_SET, AlphabeticalMarker } from './generators/config'
import { useAsk, useBlankError, useCorrectAnswer, useSidebarCorrectnessMark } from './blank/hooks'
import { matchColor } from './blank/utils'
import { AskButton } from './blank/ask'

const Choice = ({ no, options, groupId }: { no: number, options: string[], groupId: string }) => {
    const setAnswer = useSetAtom(setAnswerAtom)
    const answers = useAtomValue(answersAtom)
    const viewMode = useAtomValue(viewModeAtom)
    const answer = answers[no]
    const { getMessage, getErrorOptions } = useBlankError({ groupId, no })
    const key = useCorrectAnswer(no)
    const submittedAnswer = useAtomValue(submittedAnswersAtom)[no] as AlphabeticalMarker
    const correctAnswer = useCorrectAnswer(no) as AlphabeticalMarker
    const { ask } = useAsk({ no, groupId })

    const { Mark, parentRef } = useSidebarCorrectnessMark({ isCorrect: submittedAnswer === correctAnswer })

    return <div className='pb-2 flex flex-col gap-2 print:gap-0 print:-space-y-1'>
        {viewMode === 'track' && <>
            {getMessage()}
            {getErrorOptions().length > 0 && <div className='flex flex-col gap-1'>
                <div className='flex items-center gap-1'>
                    正确选项:
                    <Chip size='sm' variant='flat' color='success'>{key}</Chip>
                </div>
                <div className='flex items-center gap-1'>
                    错误选项:
                    {getErrorOptions().map((option, index) => (
                        <Chip key={index} size='sm' variant='flat' color='danger'>{option}</Chip>
                    ))}
                </div>
            </div>}
        </>}
        <span ref={parentRef}></span>
        {options.map((option, index) => {
            switch (viewMode) {
                case 'revise':
                    return <div key={index} className='flex items-center gap-2'>
                        <Button
                            color={matchColor([
                                [correctAnswer, 'success'],
                                [submittedAnswer, 'danger'],
                            ], ALPHABET_SET[index])}
                            variant={
                                [submittedAnswer, correctAnswer].includes(ALPHABET_SET[index])
                                    ? submittedAnswer === correctAnswer
                                        ? 'solid'
                                        : ALPHABET_SET[index] === correctAnswer
                                            ? 'flat'
                                            : 'solid'
                                    : 'ghost'
                            }
                            size='sm'
                            className='size-6'
                            radius='full'
                            isIconOnly
                            isDisabled
                            startContent={<span>{ALPHABET_SET[index]}</span>}
                        ></Button>
                        <span className='leading-tight'>
                            {option}
                        </span>
                    </div>
                default:
                    return <div key={index} className='flex items-center gap-2'>
                        <Button
                            className='size-6 print:hidden'
                            color={answer === ALPHABET_SET[index] ? 'secondary' : 'default'}
                            variant={answer === ALPHABET_SET[index] ? 'solid' : 'ghost'}
                            size='sm'
                            radius='full'
                            isIconOnly
                            isDisabled={viewMode === 'track'}
                            startContent={<span>{ALPHABET_SET[index]}</span>}
                            onPress={() => {
                                setAnswer({ questionId: no, option: ALPHABET_SET[index] })
                            }}
                        ></Button>
                        <span className='print:inline hidden'>{ALPHABET_SET[index]}.</span>
                        <span className='leading-tight'>
                            {option}
                        </span>
                    </div>
            }
        })}
        {viewMode === 'revise' && <>
            <Mark />
            <AskButton className='w-fit mt-2' variant='faded' ask={ask} />
        </>}
    </div>
}

export default Choice
