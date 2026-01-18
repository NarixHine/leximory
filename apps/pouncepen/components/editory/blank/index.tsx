'use client'

import { Popover, PopoverTrigger, PopoverContent, Button, Input, cn, Spacer, Chip } from '@heroui/react'
import { useSetAtom, useAtomValue } from 'jotai'
import { viewModeAtom, submittedAnswersAtom, editoryItemsAtom, answersAtom, setAnswerAtom } from '../atoms'
import { ALPHABET_ELEMENTS, ALPHABET_SET, AlphabeticalMarker } from '../generators/config'
import { CursorClickIcon, XCircleIcon, CheckCircleIcon } from '@phosphor-icons/react/ssr'
import { questionStrategies } from '../generators/strategies'
import { memo } from 'react'
import { useAsk, useBlankError, useBlankInfo, useCorrectAnswer, useSidebarCorrectnessMark } from './hooks'
import { matchColor } from './utils'
import { AskButton } from './ask'
import { getOptionByMarker } from '../generators/utils'

const Blank = ({ number: no, groupId, children, blankCount = 1 }: { number: number, groupId: string, children?: React.ReactNode, blankCount?: number }) => {
    const quizData = useAtomValue(editoryItemsAtom)
    const answers = useAtomValue(answersAtom)
    const submittedAnswers = useAtomValue(submittedAnswersAtom)
    const viewMode = useAtomValue(viewModeAtom)
    const answer = answers[no]
    const submittedAnswer = submittedAnswers[no]
    const spaces = '\u00A0'

    const key = useCorrectAnswer(no)
    const { ask } = useAsk({ no, groupId })
    const { getFullInfo } = useBlankInfo({ no, groupId })
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
            return answer
                ? <CursorClickIcon weight='fill' className='inline ml-2 -mr-6 mb-1 print:hidden' />
                : <CursorClickIcon className='inline ml-2 -mr-6 mb-1 print:hidden' />
        }
    }
    const getTextColor = () => {
        if (viewMode === 'revise') {
            return checkAnswerCorrectness() ? 'text-success' : 'text-danger'
        }
        return answer ? 'text-primary' : 'text-secondary'
    }
    const { getErrorOptions, getMessageColor, getMessage } = useBlankError({ no, groupId })

    const { Mark, parentRef } = useSidebarCorrectnessMark({ isCorrect: checkAnswerCorrectness() })
    const ShownBlank = (
        <span ref={parentRef} className='space-x-1'>
            {new Array(blankCount).fill(0).map((_, index) => (
                <u
                    key={index}
                    className={cn('whitespace-nowrap', viewMode !== 'track' && getTextColor(), 'print:text-black')}
                >
                    {<Icon />} <span className='print:hidden'>{spaces.repeat(6)}</span><span className='hidden print:inline'>{spaces.repeat(3)}</span>{no}<span>{spaces.repeat(3)}</span>
                </u>
            ))}
            {
                viewMode === 'revise' && <Mark />
            }
        </span>
    )

    switch (viewMode) {
        case 'pure':
            return children
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
                        <span id={`q${no}`}>
                            {ShownBlank} {!checkAnswerCorrectness() && <span className='text-danger'>[<span className='line-through'><FormattedFullAnswer /></span>; <span className='text-success'><FormattedFullKey /></span>]</span>}
                        </span>
                    </PopoverTrigger>
                    <PopoverContent>
                        <div className='p-3 flex flex-col gap-1 max-w-64'>
                            <div>你的答案是 <FormattedFullAnswer />。</div>
                            <div>参考答案是 <FormattedFullKey />。</div>
                            {children}
                            <Spacer y={1} />
                            <AskButton fullWidth ask={ask} />
                        </div>
                    </PopoverContent>
                </Popover >
            )
        }
        case 'track': {
            const { FormattedFullKey } = getFullInfo(submittedAnswer!)
            const clozeOriginal = getFullInfo(submittedAnswer!).clozeOriginal
            const errorOptions = getErrorOptions()
            const color = getMessageColor()
            return (
                <Popover shadow='sm'>
                    <PopoverTrigger>
                        <span id={`q${no}`} style={{ color }}>{ShownBlank} {getMessage()}</span>
                    </PopoverTrigger>
                    <PopoverContent className='py-4 flex flex-col gap-2 max-w-64'>
                        <div className='flex flex-col gap-1 px-2 w-full'>
                            <div>
                                参考答案是 <FormattedFullKey />。
                            </div>
                            <div>
                                学生错误选项有： {errorOptions.map(option => (
                                    <span key={option} className='font-bold text-danger not-last:after:content-[",_"] not-last:after:font-light not-last:after:text-default-foreground'>
                                        {option}{getOptionByMarker(getQuestionGroup()!, option, clozeOriginal) ? <span className='font-semibold'>. {getOptionByMarker(getQuestionGroup()!, option, clozeOriginal)}</span> : ``}
                                    </span>
                                ))}。
                            </div>
                        </div>
                        {children}
                    </PopoverContent>
                </Popover>
            )
        }
    }
}
const MemoizedBlank = memo(Blank)

export const MultipleChoice = ({ number, options, groupId }: { number: number, options?: string[], groupId: string }) => {
    const answers = useAtomValue(answersAtom)
    const setAnswer = useSetAtom(setAnswerAtom)
    const viewMode = useAtomValue(viewModeAtom)
    const answer = viewMode === 'revise' ? undefined : answers[number] as AlphabeticalMarker
    const submittedAnswers = useAtomValue(submittedAnswersAtom)
    const correctAnswer = useCorrectAnswer(number) as AlphabeticalMarker

    const content = (
        <div className='p-2 grid grid-cols-1 sm:grid-cols-2 gap-2'>
            {options?.map((option, index) => {
                const optionMarker = ALPHABET_SET[index]
                return <Button
                    key={index}
                    color={matchColor([[answer, 'secondary']], optionMarker)}
                    variant='flat'
                    size='sm'
                    isDisabled={viewMode === 'revise'}
                    onPress={() => setAnswer({ questionId: number, option: optionMarker })}
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
            case 'pure':
                return <div>
                    <div className={cn('font-bold', !answer && 'text-secondary')}>{number}.</div>
                    {content}
                </div>
            case 'revise':
            case 'track':
                return (
                    <MemoizedBlank number={number} groupId={groupId}>
                        <div className='p-2 flex flex-wrap gap-2 max-w-60'>
                            {options?.map((option, index) => {
                                const optionMarker = ALPHABET_SET[index]
                                return <Chip
                                    key={index}
                                    color={matchColor([
                                        [correctAnswer, 'success'],
                                        [submittedAnswers[number] as AlphabeticalMarker, 'danger'],
                                    ], optionMarker)}
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
                    <MemoizedBlank number={number} groupId={groupId}>
                        <PopoverContent>{content}</PopoverContent>
                    </MemoizedBlank>
                )
        }
    }

    return <MemoizedBlank number={number} groupId={groupId} />
}

export const FillInTheBlank = ({ groupId, number, blankCount = 1 }: { groupId: string, number: number, blankCount?: number }) => {
    const answers = useAtomValue(answersAtom)
    const setAnswer = useSetAtom(setAnswerAtom)
    const answer = answers[number]
    const viewMode = useAtomValue(viewModeAtom)

    const content = (
        <Input
            autoFocus
            variant='flat'
            value={answer ?? ''}
            onChange={(e) => setAnswer({ questionId: number, option: e.target.value })}
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
        case 'pure':
            return <div>
                <div className={cn('font-bold', !answer && 'text-secondary')}>{number}.</div>
                {content}
            </div>
        case 'revise':
        case 'track':
            return <MemoizedBlank
                blankCount={blankCount}
                number={number}
                groupId={groupId}
            />
        default:
            return (
                <MemoizedBlank blankCount={blankCount} number={number} groupId={groupId}>
                    <PopoverContent className='p-0'>{content}</PopoverContent>
                </MemoizedBlank>
            )
    }
}
