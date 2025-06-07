import ChatInterface from './components/chat-interface'
import { Metadata } from 'next'
import { HydrationBoundary } from 'jotai-ssr'
import { getPlan } from '@/server/auth/user'
import { lexiconAtom } from '../[lib]/[text]/atoms'

export const metadata: Metadata = {
    title: 'Talk to Your Library',
    description: '与 AI 聊天，自动化操作文库',
}

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ prompt: string }> }) {
    const plan = await getPlan()
    const { prompt } = await searchParams

    return <HydrationBoundary hydrateAtoms={[[lexiconAtom, 'none']]}>
        <ChatInterface plan={plan} initialPromptIndex={prompt ? parseInt(prompt) : null} />
    </HydrationBoundary>
} 
