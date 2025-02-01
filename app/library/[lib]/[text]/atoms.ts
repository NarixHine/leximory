'use client'

import { CustomLexicon } from '@/lib/types'
import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

export const contentAtom = atom('')
export const ebookAtom = atom<string | undefined>(undefined)
export const titleAtom = atom('')
export const textAtom = atom('')
export const inputAtom = atom('')
export const isLoadingAtom = atom(false)
export const isEditingAtom = atom(false)
export const topicsAtom = atom<string[]>([])
export const lexiconAtom = atomWithStorage<CustomLexicon>('persist-lexicon', 'gaozhong', {
    getItem: (key, initialValue) => {
        const storedValue = document.cookie.split('; ').find(row => row.startsWith(`${key}=`))
        return storedValue ? JSON.parse(decodeURIComponent(storedValue.split('=')[1])) : initialValue
    },
    setItem: (key, value) => {
        document.cookie = `${key}=${encodeURIComponent(JSON.stringify(value))}; path=/`
    },
    removeItem: (key) => {
        document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    }
})
export const hideTextAtom = atom(false)
