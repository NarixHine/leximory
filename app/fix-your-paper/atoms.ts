import { atom } from 'jotai'

export const paperFileAtom = atom<File[]>([])
export const answerFileAtom = atom<File[]>([])
export const isLoadingAtom = atom(false)
export const resultAtom = atom<string>('')
export const paperAnalysisAtom = atom<string>('')
export const useFallbackModelAtom = atom(false)
export const canSubmitAtom = atom((get) => {
    const paperFile = get(paperFileAtom)
    const answerFile = get(answerFileAtom)
    const isLoading = get(isLoadingAtom)
    return paperFile.length > 0 && answerFile.length > 0 && !isLoading
}) 
