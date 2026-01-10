import ChatInterface from './components/chat-interface'
import { Metadata } from 'next'
import { isReadOnlyAtom } from '../[lib]/atoms'
import { HydrationBoundary } from 'jotai-ssr'
import UpgradeMessage from './components/upgrade-message'

export const metadata: Metadata = {
    title: 'Talk to Your Library',
    description: '与 AI 聊天，自动化操作文库',
}

export default function ChatPage() {
    return <HydrationBoundary hydrateAtoms={[[isReadOnlyAtom, true]]}>
        <ChatInterface UpgradeMessage={<UpgradeMessage />} />
    </HydrationBoundary>
} 
