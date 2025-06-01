import { getPlan } from '@/server/auth/quota'
import ChatInterface from './components/chat-interface'
import { Metadata } from 'next'
import { getAuthOrThrow } from '@/server/auth/role'
import { HydrationBoundary } from 'jotai-ssr'
import { lexiconAtom } from '../[lib]/[text]/atoms'

export const metadata: Metadata = {
    title: 'Talk to Your Library',
    description: '与 AI 聊天，自动化操作文库',
}

export default async function Page({ searchParams }: { searchParams: Promise<{ prompt: string }> }) {
    const { userId } = await getAuthOrThrow()
    const plan = await getPlan(userId)
    const { prompt } = await searchParams

    return <HydrationBoundary hydrateAtoms={[[lexiconAtom, 'none']]}>
        <ChatInterface plan={plan} initialPromptIndex={prompt ? parseInt(prompt) : null} />
    </HydrationBoundary>
} 
