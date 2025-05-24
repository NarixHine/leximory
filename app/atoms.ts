'use client'

import { atom } from 'jotai'
import { atomWithHash } from 'jotai-location'
import { allOfItAtom } from './library/[lib]/all-of-it/atoms'

export const baseReaderModeAtom = atomWithHash('reader', false)
export const isReaderModeAtom = atom(
  (get) => get(baseReaderModeAtom) || get(allOfItAtom),
  (get, set) => set(baseReaderModeAtom, !get(baseReaderModeAtom) && !get(allOfItAtom))
)
