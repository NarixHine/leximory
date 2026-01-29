'use client'

import { Answers, QuizItems, QuizItemsSchema } from '@repo/schema/paper'
import { atom } from 'jotai'
import { atomFamily } from 'jotai-family'
import { atomWithStorage } from 'jotai/utils'

export { highlightsAtom } from './blank/atoms'

export const paperIdAtom = atom<string | null>(null)

export const viewModeAtom = atom<'normal' | 'revise'>('normal')

export const DEFAULT_PAPER_ID = 'DEFAULT-PAPER' as const
export const EDITORY_PAPER_ID = 'EDITORY-PAPER' as const
export const answersAtomFamily = atomFamily((paperId: string) =>
    EDITORY_PAPER_ID === paperId
        ? atom<Answers>({})
        : atomWithStorage<Answers>(`answers-${paperId}`, {})
)
export const submittedAnswersAtom = atom<Answers>({})
export const answersAtom = atom((get) => {
    const paperId = get(paperIdAtom) || DEFAULT_PAPER_ID
    return get(answersAtomFamily(paperId))
})
export const setAnswerAtomFamily = atomFamily((paperId: string) => atom(
    null,
    (get, set, { questionId, option }: { questionId: number, option: string }) => {
        const current = get(answersAtomFamily(paperId))
        set(answersAtomFamily(paperId), {
            ...current,
            [questionId]: option
        })
    }
))
export const setAnswerAtom = atom(
    null,
    (get, set, { questionId, option }: { questionId: number, option: string }) => {
        const paperId = get(paperIdAtom) || DEFAULT_PAPER_ID
        const current = get(answersAtomFamily(paperId))
        set(answersAtomFamily(paperId), {
            ...current,
            [questionId]: option
        })
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