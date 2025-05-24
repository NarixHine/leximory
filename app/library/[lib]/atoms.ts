'use client'

import { Lang } from '@/lib/config'
import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

export const isReadOnlyAtom = atom(false)
export const langAtom = atom<Lang>('en')
export const isStarredAtom = atom(false)
export const libAtom = atom('')
export const priceAtom = atom(10)
export const visitedTextsAtom = atomWithStorage<Record<string, boolean>>('visited-texts', {}, {
    getItem: (key, initialValue) => {
        const storedValue = localStorage.getItem(key)
        return storedValue ? JSON.parse(storedValue) : initialValue
    },
    setItem: (key, value) => {
        localStorage.setItem(key, JSON.stringify(value))
    },
    removeItem: (key) => {
        localStorage.removeItem(key)
    }
})
