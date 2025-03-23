'use client'

import { atomWithStorage } from 'jotai/utils'

export const lastOpenDateAtom = atomWithStorage<string>('last-open-date', '1970-01-01')
