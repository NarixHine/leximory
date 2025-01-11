'use client'

import { atom } from 'jotai'
import { Accent } from '@/server/db/preference'

export const accentAtom = atom<Accent>('BrE')
