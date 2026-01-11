'use client'

import { atom } from 'jotai'
import { atomFamily, atomWithStorage } from 'jotai/utils'
import { toast } from 'sonner'
import { QuizItems, QuizItemsSchema } from './generators/types'

export type Answers = Record<number, string | null>

export const paperIdAtom = atom<string | null>(null)

export const viewModeAtom = atom<'normal' | 'pure' | 'revise' | 'track'>('normal')

export const DEFAULT_PAPER_ID = 'DEFAULT-PAPER' as const
export const EDITORY_PAPER_ID = 'EDITORY-PAPER' as const
export const answersAtomFamily = atomFamily((paperId: string) =>
    EDITORY_PAPER_ID === paperId
        ? atom<Answers>({})
        : atomWithStorage<Answers>(`answers-${paperId}`, {})
)
export const submittedAnswersAtom = atom<Answers>({})
export const allStudentAnswersAtom = atom<Answers[]>([])
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
        const storedValue = localStorage.getItem(key)
        const { data, error } = QuizItemsSchema.safeParse(JSON.parse(storedValue ?? ''))
        if (error) {
            toast.error(error.message)
            return initialValue
        }
        return data
    },
    setItem(key, value) {
        try {
            QuizItemsSchema.parse(value)
            localStorage.setItem(key, JSON.stringify(value))
        } catch {
            toast.error('Invalid. Not saved.')
        }
    },
    removeItem(key) {
        localStorage.removeItem(key)
    },
})
