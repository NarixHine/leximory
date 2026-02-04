'use client'

import { Popover, PopoverTrigger, PopoverContent, Button, Input, cn, Spacer, Chip } from '@heroui/react'
import { useSetAtom, useAtomValue } from 'jotai'
import { viewModeAtom, submittedAnswersAtom, editoryItemsAtom, answersAtom, setAnswerAtom } from '../atoms'
import { ALPHABET_ELEMENTS } from '../generators/config'
import { CursorClickIcon, XCircleIcon, CheckCircleIcon } from '@phosphor-icons/react/ssr'
import { questionStrategies } from '../generators/strategies'
import { memo } from 'react'
import { useAsk, useBlankInfo, useCorrectAnswer } from './hooks'
import { matchColor } from './utils'
import { AskButton } from './ask'
import { SaveQuestionNoteButton } from './save-question-note'

/**
 * Props for the Blank component.
 * @param displayNo - The question number to display (global number)
 * @param localNo - The 1-based question number within the section (used for storage)
 * @param groupId - The section ID
 */
interface BlankProps {
    displayNo: number
    localNo: number
    groupId: string
    children?: React.ReactNode
    blankCount?: number
}

const Blank = ({ displayNo, localNo, groupId, children, blankCount = 1 }: BlankProps) => {
    const quizData = useAtomValue(editoryItemsAtom)
    const answers = useAtomValue(answersAtom)
    const submittedAnswers = useAtomValue(submittedAnswersAtom)
    const viewMode = useAtomValue(viewModeAtom)
    // Get answer using section-based structure
    const answer = answers[groupId]?.[localNo]
    const submittedAnswer = submittedAnswers[groupId]?.[localNo]
    const spaces = '\u00A0'
    const key = useCorrectAnswer({ sectionId: groupId, localNo })
    const { ask } = useAsk({ localNo, groupId })
    const { getFullInfo } = useBlankInfo({ localNo, groupId })
    const getQuestionGroup = () => quizData ? quizData.find((item) => item.id === groupId)! : null
    const checkAnswerCorrectness = () => {
        const questionGroup = getQuestionGroup()
        if (!questionGroup) return false
        const { type } = questionGroup
        const strategy = questionStrategies[type]
        const isCorrect = type && key && submittedAnswer ? strategy.isCorrect(submittedAnswer, key) : false
        return isCorrect
    }
    const Icon = () => {
        if (viewMode === 'revise') {
            return checkAnswerCorrectness()
                ? <CheckCircleIcon className='inline ml-2 -mr-6 mb-1' />
                : <XCircleIcon className='inline ml-2 -mr-6 mb-1' />
        }
        else {
            return <CursorClickIcon weight={answer ? 'fill' : 'regular'} className='inline ml-2 -mr-6 mb-1 print:hidden' />
        }
    }

    const ShownBlank = (
        <span className='space-x-1'>
            {new Array(blankCount).fill(0).map((_, index) => (
                <u
                    key={index}
                    className={cn('whitespace-nowrap print:text-black')}
                >
                    {<Icon />} <span className='print:hidden'>{spaces.repeat(6)}</span><span className='hidden print:inline'>{spaces.repeat(3)}</span>{displayNo}<span>{spaces.repeat(3)}</span>
                </u>
            ))}
        </span>
    )

    switch (viewMode) {
        case 'normal':
            return (
                <Popover shadow='sm'>
                    <PopoverTrigger>
                        {ShownBlank}
                    </PopoverTrigger>
                    {children}
                </Popover>
            )
        case 'revise': {
            const { FormattedFullAnswer, FormattedFullKey } = getFullInfo(submittedAnswer!)
            return (
                <Popover shadow='sm'>
                    <PopoverTrigger>
                        <span id={`q${displayNo}`} className={cn(!checkAnswerCorrectness() && 'text-danger')}>
                            {ShownBlank} {!checkAnswerCorrectness() && <span>(<span className='line-through'><FormattedFullAnswer /></span>; <span className='text-success'><FormattedFullKey /></span>)</span>}
                        </span>
                    </PopoverTrigger>
                    <PopoverContent>
                        <div className='p-3 flex flex-col gap-1 max-w-64'>
                            <div>你的答案是 <FormattedFullAnswer />。</div>
                            <div>参考答案是 <FormattedFullKey />。</div>
                            {children}
                            <Spacer y={1} />
                            <AskButton fullWidth ask={ask} />
                            <SaveQuestionNoteButton fullWidth localNo={localNo} groupId={groupId} />
                        </div>
                    </PopoverContent>
                </Popover >
            )
        }
    }
}
const MemoizedBlank = memo(Blank)

/**
 * MultipleChoice component for cloze/fishing/sentence choice questions.
 * @param displayNo - The question number to display (global number)
 * @param localNo - The 1-based question number within the section (used for storage)
 * @param options - Array of option texts
 * @param groupId - The section ID
 */
export const MultipleChoice = ({ displayNo, localNo, options, groupId }: { displayNo: number, localNo: number, options?: string[], groupId: string }) => {
    const answers = useAtomValue(answersAtom)
    const setAnswer = useSetAtom(setAnswerAtom)
    const viewMode = useAtomValue(viewModeAtom)
    // Get the answer for this section and local question number (stored as option text)
    const answer = viewMode === 'revise' ? undefined : answers[groupId]?.[localNo]
    const submittedAnswers = useAtomValue(submittedAnswersAtom)
    const submittedAnswer = submittedAnswers[groupId]?.[localNo]
    const correctAnswer = useCorrectAnswer({ sectionId: groupId, localNo })

    const content = (
        <div className='p-2 grid grid-cols-1 sm:grid-cols-2 gap-2'>
            {options?.map((option, index) => {
                return <Button
                    key={index}
                    color={matchColor([[answer, 'secondary']], option)}
                    variant='flat'
                    size='sm'
                    isDisabled={viewMode === 'revise'}
                    onPress={() => setAnswer({ sectionId: groupId, localQuestionNo: localNo, option })}
                >
                    <div className='max-w-48 truncate text-left'>
                        {ALPHABET_ELEMENTS[index]} {option}
                    </div>
                </Button>
            })}
        </div>
    )

    if (options && options.length > 0) {
        switch (viewMode) {
            case 'revise':
                return (
                    <MemoizedBlank displayNo={displayNo} localNo={localNo} groupId={groupId}>
                        <div className='p-2 flex flex-wrap gap-2 max-w-60'>
                            {options?.map((option, index) => {
                                return <Chip
                                    key={index}
                                    color={matchColor([
                                        [correctAnswer, 'success'],
                                        [submittedAnswer, 'danger'],
                                    ], option)}
                                    variant='flat'
                                    size='sm'
                                >
                                    <div className='max-w-48 truncate'>
                                        {ALPHABET_ELEMENTS[index]} {option}
                                    </div>
                                </Chip>
                            })}
                        </div>
                    </MemoizedBlank>
                )
            default:
                return (
                    <MemoizedBlank displayNo={displayNo} localNo={localNo} groupId={groupId}>
                        <PopoverContent>{content}</PopoverContent>
                    </MemoizedBlank>
                )
        }
    }

    return <MemoizedBlank displayNo={displayNo} localNo={localNo} groupId={groupId} />
}

/**
 * FillInTheBlank component for grammar questions.
 * @param displayNo - The question number to display (global number)
 * @param localNo - The 1-based question number within the section (used for storage)
 * @param groupId - The section ID
 */
export const FillInTheBlank = ({ groupId, displayNo, localNo, blankCount = 1 }: { groupId: string, displayNo: number, localNo: number, blankCount?: number }) => {
    const answers = useAtomValue(answersAtom)
    const setAnswer = useSetAtom(setAnswerAtom)
    // Get the answer for this section and local question number
    const answer = answers[groupId]?.[localNo]
    const viewMode = useAtomValue(viewModeAtom)

    const content = (
        <Input
            autoCapitalize='off'
            autoFocus
            variant='flat'
            value={answer ?? ''}
            onChange={(e) => setAnswer({ sectionId: groupId, localQuestionNo: localNo, option: e.target.value })}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    const section = (e.target as HTMLElement).closest('section')
                    if (!section) return

                    const inputs = Array.from(section.querySelectorAll('input, textarea'))
                    const currentIndex = inputs.indexOf(e.target as HTMLElement)
                    const nextInput = inputs[currentIndex + 1]

                    if (nextInput) {
                        (nextInput as HTMLElement).focus()
                    }
                }
            }}
        />
    )

    switch (viewMode) {
        case 'revise':
            return <MemoizedBlank
                blankCount={blankCount}
                displayNo={displayNo}
                localNo={localNo}
                groupId={groupId}
            />
        default:
            return (
                <MemoizedBlank blankCount={blankCount} displayNo={displayNo} localNo={localNo} groupId={groupId}>
                    <PopoverContent className='p-0'>{content}</PopoverContent>
                </MemoizedBlank>
            )
    }
}
