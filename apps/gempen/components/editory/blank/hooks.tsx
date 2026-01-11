'use client'

import { useAtomValue, useSetAtom } from 'jotai'
import { applyStrategy, getClozeOriginalWord, getKey, getOptionByMarker, getQuestionStarts } from '../generators/utils'
import { allStudentAnswersAtom, editoryItemsAtom, submittedAnswersAtom } from '../atoms'
import { askParamsAtom, openAskAtom } from './atoms'
import { useCallback, useRef, useState } from 'react'
import { useDebounceCallback } from 'usehooks-ts'
import { cn } from '@heroui/theme'
import { CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react'
import useResizeObserver from 'use-resize-observer'

type BlankIdentifier = {
    no: number
    groupId: string
}

export const useCorrectAnswer = (no: number) => {
    const quizData = useAtomValue(editoryItemsAtom)
    if (!quizData) return null
    const correctAnswer = getKey(quizData)[no]
    return correctAnswer
}

export const useBlankInfo = ({ no, groupId }: BlankIdentifier) => {
    const quizData = useAtomValue(editoryItemsAtom)
    const key = useCorrectAnswer(no)
    const getRelativeQuestionIndex = () => {
        const start = getQuestionStarts(quizData)[quizData.findIndex((item) => item.id === groupId)]
        return no - start + 1
    }
    const getQuestionGroup = () => quizData.find((item) => item.id === groupId)!
    const getFullInfo = (submittedAnswer: string) => {
        const questionGroup = getQuestionGroup()
        const clozeOriginal = questionGroup?.type === 'cloze' && getClozeOriginalWord(questionGroup, getRelativeQuestionIndex()) || undefined
        const fullAnswer = getOptionByMarker(questionGroup, submittedAnswer, clozeOriginal)
        const fullKey = clozeOriginal || getOptionByMarker(questionGroup, key!, clozeOriginal)
        const FormattedFullAnswer = () => (
            <span className='font-semibold'>
                {submittedAnswer ?? '∅'}{fullAnswer ? <span className='font-light'>. {fullAnswer}</span> : <></>}
            </span>
        )
        const FormattedFullKey = () => (
            <span className='font-semibold'>
                {key}<span>
                    {fullKey ? <span className='font-light'>. {fullKey}</span> : <></>}
                </span>
            </span>
        )
        return { fullAnswer, fullKey, clozeOriginal, FormattedFullAnswer, FormattedFullKey }
    }
    return { getRelativeQuestionIndex, getQuestionGroup, getFullInfo }
}

export const useAsk = ({ no, groupId }: BlankIdentifier) => {
    const setAskParams = useSetAtom(askParamsAtom)
    const setOpen = useSetAtom(openAskAtom)
    const submittedAnswer = useAtomValue(submittedAnswersAtom)[no]
    const { getRelativeQuestionIndex, getQuestionGroup, getFullInfo } = useBlankInfo({ no, groupId })
    const getAskParams = () => {
        const { fullAnswer, fullKey } = getFullInfo(submittedAnswer!)
        return {
            quizData: getQuestionGroup(),
            questionNo: getRelativeQuestionIndex(),
            userAnswer: `${submittedAnswer}${fullAnswer ? `. ${fullAnswer}` : ''}${fullKey ? ` (Correct answer: ${fullKey})` : ''}` || '[No Answer Submitted]',
        }
    }
    const ask = () => {
        setAskParams(getAskParams())
        setOpen(true)
    }

    return { ask }
}

export const useScrollToMatch = () => {
    const scrollTo = useCallback((targetString: string): void => {
        if (!targetString || typeof targetString !== 'string' || targetString.length === 0) {
            return
        }

        let mostPreciseElement: HTMLElement | null = null
        let firstTextNode: Node | null = null

        // Efficiently locate the text node containing the target string
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)
        let node: Node | null
        while ((node = walk.nextNode())) {
            if (node.nodeValue?.includes(targetString)) {
                firstTextNode = node
                break // Stop at the first occurrence
            }
        }

        if (firstTextNode) {
            // The parent element of the text node is the most precise target
            mostPreciseElement = firstTextNode.parentElement

            if (mostPreciseElement) {
                mostPreciseElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                })
            }
        }
    }, [])

    return { scrollTo }
}

export const useSidebarCorrectnessMark = ({ isCorrect }: {
    isCorrect: boolean
}) => {
    const parentRef = useRef<HTMLElement>(null)
    const documentRef = useRef(globalThis.document?.body)
    const [verticalPosition, setVerticalPosition] = useState(0)
    const resetTop = useDebounceCallback(() => {
        if (parentRef.current) {
            const { top } = parentRef.current.getBoundingClientRect()
            setVerticalPosition(top + globalThis.scrollY)
        }
    }, 100)
    useResizeObserver({
        ref: documentRef.current,
        onResize: resetTop
    })
    return {
        Mark: () => <span
            className={cn('absolute hidden sm:inline-block left-2 text-xl', isCorrect ? 'text-success' : 'text-danger')}
            style={{ top: verticalPosition }}
        >
            {isCorrect ? <CheckCircleIcon weight='duotone' /> : <XCircleIcon weight='duotone' />}
        </span>,
        parentRef
    }
}

export const useBlankError = ({ no, groupId }: BlankIdentifier) => {
    const { getQuestionGroup } = useBlankInfo({ no, groupId })
    const allStudentAnswers = useAtomValue(allStudentAnswersAtom)
    const key = useCorrectAnswer(no)
    const aggregatedAnswers = allStudentAnswers.map(item => {
        const ans = item[no]
        return {
            isCorrect: ans && key ? applyStrategy(
                getQuestionGroup(),
                (strategy) => strategy.isCorrect(ans, key)
            ) : false,
            answer: ans || '∅',
        }
    })
    const getErrorRate = () => aggregatedAnswers.map((item): number => item.isCorrect ? 0 : 1).reduce((a, b) => a + b, 0) / allStudentAnswers.length
    const getErrorOptions = () => Array.from(new Set(aggregatedAnswers.filter(item => !item.isCorrect).map(item => item.answer))).toSorted()
    const growthFunction = (x: number): number => {
        // Ensure input is within the [0, 1] range
        if (x <= 0) return 0.1 // Function starts at 0.1
        if (x >= 1) return 1   // Function ends at 1

        const transitionX = 0.25 // New inflection point
        const transitionY = 0.2  // Value of f(transitionX)

        if (x <= transitionX) {
            // First piece: Slow growth (k=2, parabolic)
            // f(x) = c1 * x^2 + f(0)
            const c1 = 1.6
            return c1 * x * x + 0.1
        } else {
            // Second piece: Rapid growth (k=0.25, i.e., fourth root)
            // f(x) = c2 * (x - transitionX)^0.25 + transitionY
            const c2 = 0.8596 // Constant derived for f(1) = 1 and k=0.25
            return c2 * Math.pow(x - transitionX, 0.25) + transitionY
        }
    }
    const getMessageColor = () => getErrorRate() < 0.1 ? (getErrorRate() > 0 ? `rgba(136, 231, 136, 0.8)` : `inherit`) : `rgba(220, 38, 38, ${growthFunction(getErrorRate())})`
    const getMessage = () => <span className='font-mono text-sm hover:text-default-foreground!' style={{ color: getMessageColor() }}>
        [Error Rate: {(getErrorRate() * 100).toPrecision(4)}%
        {getErrorOptions().length > 0 && <>; Wrong Answer{getErrorOptions().length > 1 ? 's' : ''}: {getErrorOptions().map(option => (
            <span key={option} className='font-bold not-last:after:content-[",_"] not-last:after:font-light'>{option}</span>
        ))}</>}]
    </span>
    return { getErrorRate, getErrorOptions, getMessageColor, getMessage }
}
