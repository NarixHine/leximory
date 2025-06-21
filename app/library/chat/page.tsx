import ChatInterface from './components/chat-interface'
import { Metadata } from 'next'
import { getPlan } from '@/server/auth/user'
import { isReadOnlyAtom } from '../[lib]/atoms'
import { HydrationBoundary } from 'jotai-ssr'

export const metadata: Metadata = {
    title: 'Talk to Your Library',
    description: '与 AI 聊天，自动化操作文库',
}

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ prompt: string }> }) {
    const plan = await getPlan()
    const { prompt } = await searchParams

    return <HydrationBoundary hydrateAtoms={[[isReadOnlyAtom, true]]}>
        <ChatInterface plan={plan} initialPromptIndex={prompt ? parseInt(prompt) : null} />
    </HydrationBoundary>
} 
