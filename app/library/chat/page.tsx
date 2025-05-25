'use client'

import { useChat } from '@ai-sdk/react'
import { useAtom, useSetAtom } from 'jotai'
import { messagesAtom, persistMessagesAtom } from './atoms'
import { PiPaperPlaneRightFill, PiSpinnerGap, PiChatCircleDotsDuotone, PiPlusCircleDuotone, PiStopCircleDuotone } from 'react-icons/pi'
import { useRef } from 'react'
import Markdown from '@/components/markdown'
import { cn } from '@/lib/utils'
import { Card, CardBody } from '@heroui/card'
import { Button } from '@heroui/button'
import { Input, Textarea } from '@heroui/input'
import { chatFontFamily, postFontFamily } from '@/lib/fonts'
import type { ToolResult, ToolName } from './types'
import Main from '@/components/ui/main'
import LibraryComponent from '@/app/library/components/lib'
import TextComponent from '@/app/library/[lib]/components/text'
import { Spinner } from '@heroui/spinner'
import { toast } from 'sonner'

type MessagePart = {
    type: 'text' | 'reasoning' | 'tool-invocation' | 'source' | 'step-start'
    text?: string
    toolName?: string
    toolCallId?: string
    state?: string
    result?: any
    toolInvocation?: {
        state: string
        step: number
        toolCallId: string
        toolName: string
        args: any
        result: any
    }
}

function ToolState({ state, toolName }: { state: string; toolName: string }) {
    if (state === 'loading') {
        return (
            <div className='flex items-center gap-2 text-sm text-default-400'>
                <PiSpinnerGap className='animate-spin' size={16} />
                <span>Loading {toolName}...</span>
            </div>
        )
    }
    if (state === 'error') {
        return (
            <div className='text-sm text-danger'>
                Failed to load {toolName}
            </div>
        )
    }
    return null
}

function ToolResult({ toolName, result }: { toolName: ToolName; result: ToolResult[ToolName] }) {
    switch (toolName) {
        case 'listLibs':
            return (
                <div className='mt-2 space-y-2'>
                    {(result as unknown as Awaited<ToolResult['listLibs']>).map((lib) => (
                        <LibraryComponent
                            key={lib.id}
                            id={lib.id}
                            name={lib.name}
                            lexicon={{ count: NaN }}
                            lang={lib.lang}
                            isOwner={false}
                            access={lib.access}
                            orgId={null}
                            shadow={false}
                            orgs={[]}
                            price={0}
                            archived={false}
                            isStarred={false}
                        />
                    ))}
                </div>
            )

        case 'getLib':
            const lib = result as unknown as Awaited<ToolResult['getLib']>
            return (
                <div className='mt-2'>
                    <LibraryComponent
                        id={lib.id}
                        name={lib.name}
                        lexicon={{ count: NaN }}
                        lang={lib.lang}
                        isOwner={false}
                        access={lib.access}
                        orgId={null}
                        shadow={false}
                        orgs={[]}
                        price={0}
                        archived={false}
                        isStarred={false}
                    />
                </div>
            )

        case 'getAllTextsInLib':
        case 'getTexts':
            return (
                <div className='mt-2 grid grid-cols-1 md:grid-cols-2 gap-5'>
                    {(result as unknown as Awaited<ToolResult['getAllTextsInLib']>).map((text) => (
                        <TextComponent
                            key={text.id}
                            id={text.id}
                            title={text.title}
                            topics={text.topics || []}
                            hasEbook={text.hasEbook || false}
                            createdAt={text.createdAt}
                            updatedAt={text.updatedAt}
                        />
                    ))}
                </div>
            )

        case 'getTextContent':
            const text = result as unknown as Awaited<ToolResult['getTextContent']>
            return (
                <Card className='mt-2 bg-primary-50/20' shadow='none' isBlurred>
                    <CardBody className='p-6'>
                        <div className='text-2xl mb-2' style={{ fontFamily: postFontFamily }}>{text.title}</div>
                        <div className='text-default-600 dark:text-default-400'>
                            <Markdown md={text.content} className='prose dark:prose-invert max-w-none' fontFamily={postFontFamily} />
                        </div>
                    </CardBody>
                </Card>
            )

        case 'getForgetCurve':
            return (
                <div className='mt-2'>
                    <span className='text-sm text-default-400 font-mono'>Retrieving words ...</span>
                </div>
            )

        default:
            return null
    }
}

function MessagePart({ part, isUser }: { part: MessagePart; isUser: boolean }) {
    switch (part.type) {
        case 'text':
            return (
                <div className={cn(
                    'px-4 mt-4 rounded-2xl max-w-[80%] text-base whitespace-pre-wrap',
                    isUser
                        ? 'bg-secondary-50/50 text-default-900 py-2'
                        : 'bg-primary-50/50 text-default-900 pt-3 pb-0'
                )}>
                    {part.text ? <Markdown
                        fontFamily={chatFontFamily}
                        md={part.text}
                        className='prose dark:prose-invert max-w-none'
                        hasWrapped={true}
                    /> : <Spinner className='w-4 h-4' />}
                </div>
            )
        case 'tool-invocation':
            if (part.toolInvocation?.state === 'result' && part.toolInvocation.result) {
                return (
                    <div className='mt-2 w-full'>
                        <ToolResult
                            toolName={part.toolInvocation.toolName as ToolName}
                            result={part.toolInvocation.result as ToolResult[ToolName]}
                        />
                    </div>
                )
            }
            return (
                <div className='mt-4'>
                    <ToolState state={part.toolInvocation?.state || ''} toolName={part.toolInvocation?.toolName || ''} />
                </div>
            )
        default:
            return <></>
    }
}

function Chat() {
    const [messages, setMessages] = useAtom(messagesAtom)
    const setPersistMessages = useSetAtom(persistMessagesAtom)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const { messages: aiMessages, input, setInput, handleSubmit, status, setData, stop } = useChat({
        api: '/api/library/chat',
        initialMessages: messages,
        onFinish: () => {
            setMessages(aiMessages)
            setPersistMessages(aiMessages)
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        },
        onError: () => {
            toast.error('发生错误')
        }
    })

    const startNewConversation = () => {
        setMessages([])
        setPersistMessages([])
        setInput('')
        setData([])
    }

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || status === 'streaming') return
        setInput('')
        handleSubmit(e)
    }

    const handleButtonClick = () => {
        if (status === 'streaming') {
            stop()
        } else {
            handleFormSubmit(new Event('submit') as any)
        }
    }

    return (
        <Main style={{ fontFamily: chatFontFamily }} className='flex flex-col max-w-2xl'>
            <div className='flex justify-end mb-4'>
                <Button
                    color='primary'
                    variant='flat'
                    startContent={<PiPlusCircleDuotone />}
                    onPress={startNewConversation}
                >
                    开始新对话
                </Button>
            </div>
                {aiMessages.map((m, i) => (
                <div key={i} className={cn(
                    'mb-4 flex flex-col',
                    m.role === 'user' ? 'items-end' : 'items-start'
                )}>
                    {m.parts?.map((part, j) => (
                        <MessagePart key={j} part={part as MessagePart} isUser={m.role === 'user'} />
                    ))}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            <form
                onSubmit={handleFormSubmit}
                className='flex items-center gap-2'
            >
                <Textarea
                    className='flex-1'
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder='输入你的问题...'
                    disabled={status === 'streaming'}
                    maxRows={5}
                    autoComplete='off'
                    startContent={<PiChatCircleDotsDuotone className='text-default-400' />}
                />
                <Button
                    type='button'
                    color='primary'
                    isIconOnly
                    className='self-start'
                    disabled={!input.trim() && status !== 'streaming'}
                    aria-label={status === 'streaming' ? '停止' : '发送'}
                    onPress={handleButtonClick}
                >
                    {status === 'streaming' ? (
                        <PiStopCircleDuotone size={22} />
                    ) : (
                        <PiPaperPlaneRightFill size={22} />
                    )}
                </Button>
            </form>
        </Main>
    )
}

export default Chat 