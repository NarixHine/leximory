'use client'

import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'

export interface ReviewProgressData {
    percentage: number
    conversationCompleted: boolean
}

export const reviewProgressFamily = atomFamily((_key: string) =>
    atom<ReviewProgressData | null>(null)
)
