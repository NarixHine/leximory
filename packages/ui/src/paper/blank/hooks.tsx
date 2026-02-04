'use client'

import { useAtomValue, useSetAtom } from 'jotai'
import { getClozeOriginalWord, getSectionKey } from '../generators/utils'
import { editoryItemsAtom, submittedAnswersAtom } from '../atoms'
import { askParamsAtom, openAskAtom } from './atoms'
import { useCallback } from 'react'

/**
 * Identifier for a blank/question using section-based structure.
 * @param localNo - The 1-based question number within the section
 * @param groupId - The section ID
 */
type BlankIdentifier = {
    localNo: number
    groupId: string
}

/**
 * Hook to get the correct answer for a question.
 * Returns the correct answer text (not the marker).
 * @param sectionId - The section ID
 * @param localNo - The 1-based question number within the section
 */
export const useCorrectAnswer = ({ sectionId, localNo }: { sectionId: string, localNo: number }) => {
    const quizData = useAtomValue(editoryItemsAtom)
    if (!quizData) return null
    const sectionKey = getSectionKey(quizData, sectionId)
    return sectionKey?.[localNo] ?? null
}

export const useBlankInfo = ({ localNo, groupId }: BlankIdentifier) => {
    const quizData = useAtomValue(editoryItemsAtom)
    const key = useCorrectAnswer({ sectionId: groupId, localNo })
    const getQuestionGroup = () => quizData.find((item) => item.id === groupId)!
    const getFullInfo = (submittedAnswer: string | null | undefined) => {
        const questionGroup = getQuestionGroup()
        const clozeOriginal = questionGroup?.type === 'cloze' && getClozeOriginalWord(questionGroup, localNo) || undefined
        // With the new structure, submittedAnswer and key are already the full text
        const FormattedFullAnswer = () => (
            <span className='font-semibold'>
                {submittedAnswer ?? '∅'}
            </span>
        )
        const FormattedFullKey = () => (
            <span className='font-semibold'>
                {key}
            </span>
        )
        return { clozeOriginal, FormattedFullAnswer, FormattedFullKey, key }
    }
    return { localNo, getQuestionGroup, getFullInfo }
}

export const useAsk = ({ localNo, groupId }: BlankIdentifier) => {
    const setAskParams = useSetAtom(askParamsAtom)
    const setOpen = useSetAtom(openAskAtom)
    const submittedAnswer = useAtomValue(submittedAnswersAtom)[groupId]?.[localNo]
    const { getQuestionGroup, getFullInfo } = useBlankInfo({ localNo, groupId })
    const getAskParams = () => {
        const { key } = getFullInfo(submittedAnswer)
        return {
            quizData: getQuestionGroup(),
            questionNo: localNo,
            userAnswer: `${submittedAnswer}${key ? ` (Correct answer: ${key})` : ''}` || '[No Answer Submitted]',
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
