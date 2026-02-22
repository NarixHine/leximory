'use client'

import { Button } from '@heroui/react'
import { useSetAtom, useAtomValue } from 'jotai'
import { viewModeAtom, submittedAnswersAtom, setAnswerAtom, answersAtom } from './atoms'
import { ALPHABET_SET } from './generators/config'
import { useAsk, useCorrectAnswer } from './blank/hooks'
import { matchColor } from './blank/utils'
import { AskButton } from './blank/ask'
import { safeParseHTML } from '../utils/parse'

/**
 * Choice component for rendering multiple choice questions.
 * @param localNo - The 1-based question number within the section (not global)
 * @param options - Array of option texts
 * @param groupId - The section ID
 */
const Choice = ({ localNo, options, groupId }: { localNo: number, options: string[], groupId: string }) => {
    const setAnswer = useSetAtom(setAnswerAtom)
    const answers = useAtomValue(answersAtom)
    const viewMode = useAtomValue(viewModeAtom)
    // Get the answer for this section and local question number (stored as option text)
    const answer = answers[groupId]?.[localNo]
    const submittedAnswer = useAtomValue(submittedAnswersAtom)[groupId]?.[localNo]
    const correctAnswer = useCorrectAnswer({ sectionId: groupId, localNo })
    const { ask } = useAsk({ localNo, groupId })

    return <div className='pb-2 flex flex-col gap-2 print:gap-0 print:-space-y-1'>
        {options.map((option, index) => {
            switch (viewMode) {
                case 'revise':
                    return <div key={index} className='flex items-center gap-2'>
                        <Button
                            color={matchColor([
                                [correctAnswer, 'success'],
                                [submittedAnswer, 'danger'],
                            ], option)}
                            variant={
                                [submittedAnswer, correctAnswer].includes(option)
                                    ? submittedAnswer === correctAnswer
                                        ? 'solid'
                                        : option === correctAnswer
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
                            {safeParseHTML(option)}
                        </span>
                    </div>
                default:
                    return <div key={index} className='flex items-center gap-2'>
                        <Button
                            className='size-6 print:hidden'
                            color={answer === option ? 'secondary' : 'default'}
                            variant={answer === option ? 'solid' : 'ghost'}
                            size='sm'
                            radius='full'
                            isIconOnly
                            startContent={<span>{ALPHABET_SET[index]}</span>}
                            onPress={() => {
                                setAnswer({ sectionId: groupId, localQuestionNo: localNo, option })
                            }}
                        ></Button>
                        <span className='print:inline hidden'>{ALPHABET_SET[index]}.</span>
                        <span className='leading-tight'>
                            {safeParseHTML(option)}
                        </span>
                    </div>
            }
        })}
        {viewMode === 'revise' && <AskButton className='w-fit mt-2' variant='faded' ask={ask} />}
    </div>
}

export default Choice
