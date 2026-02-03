'use client'

import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

type WorkingPaper = {
    id: number
    title: string
    isCompleted?: boolean
}
const workingPapersAtom = atomWithStorage<WorkingPaper[]>('working-papers', [])
const addWorkingPaperAtom = atom(
    null,
    (get, set, paper: WorkingPaper) => {
        const current = get(workingPapersAtom)
        if (!current.find(p => p.id === paper.id)) {
            set(workingPapersAtom, [...current, paper])
        }
    }
)
const setWorkingPaperCompletedAtom = atom(
    null,
    (get, set, paperId: number) => {
        const current = get(workingPapersAtom)
        set(workingPapersAtom, current.map(p => p.id === paperId ? { ...p, isCompleted: true } : p))
    }
)
const removeWorkingPaperAtom = atom(
    null,
    (get, set, paperId: number) => {
        const current = get(workingPapersAtom)
        set(workingPapersAtom, current.filter(p => p.id !== paperId))
    }
)

export { workingPapersAtom, addWorkingPaperAtom, removeWorkingPaperAtom, setWorkingPaperCompletedAtom }
