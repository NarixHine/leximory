'use client'

import { Button } from '@heroui/react'
import { useSetAtom, useAtomValue } from 'jotai'
import { viewModeAtom, submittedAnswersAtom, setAnswerAtom, answersAtom } from './atoms'
import { ALPHABET_SET, AlphabeticalMarker } from './generators/config'
import { useAsk, useCorrectAnswer } from './blank/hooks'
import { matchColor } from './blank/utils'
import { AskButton } from './blank/ask'

const Choice = ({ no, options, groupId }: { no: number, options: string[], groupId: string }) => {
    const setAnswer = useSetAtom(setAnswerAtom)
    const answers = useAtomValue(answersAtom)
    const viewMode = useAtomValue(viewModeAtom)
    const answer = answers[no]
    const submittedAnswer = useAtomValue(submittedAnswersAtom)[no] as AlphabeticalMarker
    const correctAnswer = useCorrectAnswer(no) as AlphabeticalMarker
    const { ask } = useAsk({ no, groupId })

    return <div className='pb-2 flex flex-col gap-2 print:gap-0 print:-space-y-1'>
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
        {viewMode === 'revise' && <AskButton className='w-fit mt-2' variant='faded' ask={ask} />}
    </div>
}

export default Choice
