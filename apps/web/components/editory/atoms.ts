'use client'

import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'

export interface AnswerState {
    answers: Record<number, string | null>
}

export const answerAtomFamily = atomFamily(() =>
    atom<AnswerState>({
        answers: {}
    })
)

export const setAnswerAtomFamily = atomFamily((id: string) => atom(
    null,
    (get, set, { questionId, option }: { questionId: number, option: string }) => {
        const answerAtom = answerAtomFamily(id)
        const current = get(answerAtom)
        set(answerAtom, {
            ...current,
            answers: {
                ...current.answers,
                [questionId]: option
            }
        })
    }
))

export const getAnswerAtomFamily = atomFamily((id: string) =>
    atom((get) => (questionId: number) => {
        const answerAtom = answerAtomFamily(id)
        const { answers } = get(answerAtom)
        return answers[questionId] || null
    })
)
