'use client'

import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

const workingPapersAtom = atomWithStorage<{ id: number, title: string }[]>('working-papers', [])
const addWorkingPaperAtom = atom(
    null,
    (get, set, paper: { id: number, title: string }) => {
        const current = get(workingPapersAtom)
        if (!current.find(p => p.id === paper.id)) {
            set(workingPapersAtom, [...current, paper])
        }
    }
)
const removeWorkingPaperAtom = atom(
    null,
    (get, set, paperId: number) => {
        const current = get(workingPapersAtom)
        set(workingPapersAtom, current.filter(p => p.id !== paperId))
    }
)

export { workingPapersAtom, addWorkingPaperAtom, removeWorkingPaperAtom }
