'use client'

import { SectionAnswers, QuizItems, QuizItemsSchema } from '@repo/schema/paper'
import { atom } from 'jotai'
import { atomFamily } from 'jotai-family'
import { atomWithStorage } from 'jotai/utils'
import { nanoid } from 'nanoid'

export { highlightsAtom } from './blank/atoms'

export const paperIdAtom = atom<string | null>(null)

export const passcodeAtom = atom<string | null>(null)

export const viewModeAtom = atom<'normal' | 'revise'>('normal')

export const DEFAULT_PAPER_ID = 'DEFAULT-PAPER' as const
export const EDITORY_PAPER_ID = 'EDITORY-PAPER' as const

/**
 * Family of atoms that store section-based answers for each paper.
 * Structure: { sectionId: { localQuestionNo: optionText } }
 * Note: Uses v2 storage key to avoid conflicts with legacy answer format.
 */
export const answersAtomFamily = atomFamily((paperId: string) =>
    EDITORY_PAPER_ID === paperId
        ? atom<SectionAnswers>({})
        : atomWithStorage<SectionAnswers>(`answers-v2-${paperId}`, {})
)

/**
 * Atom for storing submitted answers in revise mode.
 * Uses the new section-based structure.
 */
export const submittedAnswersAtom = atom<SectionAnswers>({})

/**
 * Derived atom that returns the answers for the current paper.
 */
export const answersAtom = atom((get) => {
    const paperId = get(paperIdAtom) || DEFAULT_PAPER_ID
    return get(answersAtomFamily(paperId))
})

/**
 * Atom family for setting an answer within a specific paper.
 * @param sectionId - The section ID
 * @param localQuestionNo - The 1-based question number within the section
 * @param option - The actual answer text (not the marker)
 */
export const setAnswerAtomFamily = atomFamily((paperId: string) => atom(
    null,
    (get, set, { sectionId, localQuestionNo, option }: { sectionId: string, localQuestionNo: number, option: string }) => {
        const current = get(answersAtomFamily(paperId))
        set(answersAtomFamily(paperId), {
            ...current,
            [sectionId]: {
                ...(current[sectionId] || {}),
                [localQuestionNo]: option
            }
        })
    }
))

/**
 * Atom for setting an answer in the current paper.
 * @param sectionId - The section ID
 * @param localQuestionNo - The 1-based question number within the section
 * @param option - The actual answer text (not the marker)
 */
export const setAnswerAtom = atom(
    null,
    (get, set, { sectionId, localQuestionNo, option }: { sectionId: string, localQuestionNo: number, option: string }) => {
        const paperId = get(paperIdAtom) || DEFAULT_PAPER_ID
        const current = get(answersAtomFamily(paperId))
        set(answersAtomFamily(paperId), {
            ...current,
            [sectionId]: {
                ...(current[sectionId] || {}),
                [localQuestionNo]: option
            }
        })
    }
)

export interface MarkedItem {
    id: string
    text: string
    xpath: string
    timestamp: number
}

export const markedItemsAtomFamily = atomFamily((paperId: string) =>
    atomWithStorage<MarkedItem[]>(`marked-items-${paperId}`, [])
)
export const markedItemsAtom = atom((get) => {
    const paperId = get(paperIdAtom) || DEFAULT_PAPER_ID
    return get(markedItemsAtomFamily(paperId))
})
export const addMarkedItemAtom = atom(
    null,
    (get, set, { text, xpath }: { text: string, xpath: string }) => {
        const paperId = get(paperIdAtom) || DEFAULT_PAPER_ID
        const current = get(markedItemsAtomFamily(paperId))
        const newItem: MarkedItem = {
            id: nanoid(),
            text,
            xpath,
            timestamp: Date.now()
        }
        set(markedItemsAtomFamily(paperId), [...current, newItem])
    }
)
export const removeMarkedItemAtom = atom(
    null,
    (get, set, { id }: { id: string }) => {
        const paperId = get(paperIdAtom) || DEFAULT_PAPER_ID
        const current = get(markedItemsAtomFamily(paperId))
        set(markedItemsAtomFamily(paperId), current.filter(item => item.id !== id))
    }
)
export const clearMarkedItemsAtom = atom(
    null,
    (get, set) => {
        const paperId = get(paperIdAtom) || DEFAULT_PAPER_ID
        set(markedItemsAtomFamily(paperId), [])
    }
)

export const editoryItemsAtom = atomWithStorage<QuizItems>('editory-items', [], {
    getItem(key, initialValue) {
        if (typeof window === 'undefined')
            return initialValue

        const storedValue = localStorage.getItem(key)
        if (!storedValue) return initialValue

        try {
            const parsed = JSON.parse(storedValue)
            const { data, success } = QuizItemsSchema.safeParse(parsed)
            return success ? data : initialValue
        } catch {
            return initialValue
        }
    },
    setItem(key, value) {
        if (typeof window === 'undefined')
            return
        localStorage.setItem(key, JSON.stringify(value))
    },
    removeItem(key) {
        localStorage.removeItem(key)
    },
})