'use client'

import { Lang } from '@/lib/config'
import { atom } from 'jotai'

export const isReadOnlyAtom = atom(false)
export const langAtom = atom<Lang>('en')
export const isStarredAtom = atom(false)
export const libAtom = atom('')
export const priceAtom = atom(10)
