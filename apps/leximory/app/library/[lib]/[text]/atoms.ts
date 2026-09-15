'use client'

import { CustomLexicon, EbookBookmark } from '@/lib/types'
import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

export const contentAtom = atom('')
export const ebookAtom = atom<string | null | undefined>(undefined)
export const titleAtom = atom('')
export const textAtom = atom('')
export const inputAtom = atom('')
export const isLoadingAtom = atom(false)
export const isEditingAtom = atom(false)
export const topicsAtom = atom<string[]>([])
export const lexiconAtom = atomWithStorage<CustomLexicon>('persist-lexicon', 'none')
export const hideTextAtom = atom(false)
export const inlineModeAtom = atom(false)
export const promptAtom = atom('')
export const emojiAtom = atom<string | null>(null)
export const isFullViewportAtom = atom(false)
export const bookmarksAtom = atom<EbookBookmark[]>([])
/** Live reader position for the current text. Set once from the server, then owned by the client. */
export const locationAtom = atom<string | number>(0)
/** Server-persisted position, used only to seed `locationAtom`. */
export const initialLocationAtom = atom<string | number | null>(null)
