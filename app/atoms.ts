'use client'

import { atom } from 'jotai'

const baseReaderModeAtom = atom(false)
export const isReaderModeAtom = atom(
  (get) => get(baseReaderModeAtom),
  (get, set) => set(baseReaderModeAtom, !get(baseReaderModeAtom))
)
