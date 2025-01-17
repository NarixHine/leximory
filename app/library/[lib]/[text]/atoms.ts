'use client'

import { CustomLexicon } from '@/lib/types'
import { atom } from 'jotai'

export const contentAtom = atom('')
export const ebookAtom = atom<string | undefined>(undefined)
export const titleAtom = atom('')
export const textAtom = atom('')
export const inputAtom = atom('')
export const isLoadingAtom = atom(false)
export const isEditingAtom = atom(false)
export const topicsAtom = atom<string[]>([])
export const lexiconAtom = atom<CustomLexicon>('cet6')
export const hideTextAtom = atom(false)
