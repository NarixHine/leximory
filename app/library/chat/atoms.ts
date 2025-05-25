'use client'

import { atom } from 'jotai'

export type ChatMessage = {
    id: string
    role: 'user' | 'assistant' | 'system' | 'data'
    content: string
    parts?: any[]
}

function getInitialMessages(): ChatMessage[] {
    if (typeof window === 'undefined') return []
    try {
        const stored = localStorage.getItem('library-chat-messages')
        return stored ? JSON.parse(stored) : []
    } catch {
        return []
    }
}

export const messagesAtom = atom<ChatMessage[]>(getInitialMessages())

messagesAtom.onMount = set => {
    if (typeof window === 'undefined') return
    const update = () => {
        try {
            const stored = localStorage.getItem('library-chat-messages')
            set(stored ? JSON.parse(stored) : [])
        } catch {}
    }
    window.addEventListener('storage', update)
    return () => window.removeEventListener('storage', update)
}

export const persistMessagesAtom = atom(
    null,
    (get, set, messages: ChatMessage[]) => {
        set(messagesAtom, messages)
        if (typeof window !== 'undefined') {
            localStorage.setItem('library-chat-messages', JSON.stringify(messages))
        }
    }
) 