'use client'

import { atomWithStorage } from 'jotai/utils'
import type { Message as UIMessage } from '@ai-sdk/react'

export type Message = UIMessage

export const messagesAtom = atomWithStorage<Message[]>('chat-messages', [], {
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
