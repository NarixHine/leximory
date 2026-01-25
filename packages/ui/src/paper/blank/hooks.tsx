'use client'

import { useAtomValue, useSetAtom } from 'jotai'
import { getClozeOriginalWord, getKey, getOptionByMarker, getQuestionStarts } from '../generators/utils'
import { editoryItemsAtom, submittedAnswersAtom } from '../atoms'
import { askParamsAtom, openAskAtom } from './atoms'
import { useCallback } from 'react'

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
