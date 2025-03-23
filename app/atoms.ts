'use client'

import { atom } from 'jotai'
import { atomWithHash } from 'jotai-location'

const baseReaderModeAtom = atomWithHash('reader', false)
export const isReaderModeAtom = atom(
  (get) => get(baseReaderModeAtom),
  (get, set) => set(baseReaderModeAtom, !get(baseReaderModeAtom))
)
