import { getPlan } from '@/server/auth/quota'
import ChatInterface from './components/chat-interface'
import { Metadata } from 'next'
import { getAuthOrThrow } from '@/server/auth/role'

export const metadata: Metadata = {
    title: 'AI 聊天',
    description: '与 AI 聊天，自动化操作文库',
}

export default async function Page() {
    const { userId } = await getAuthOrThrow()
    const plan = await getPlan(userId)

    return <ChatInterface plan={plan} />
} 
