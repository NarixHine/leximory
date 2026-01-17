'use client'

import { AccordionProps, Accordion, AccordionItem } from '@heroui/accordion'
import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import { Card, CardBody } from '@heroui/react'
import { Spinner } from '@heroui/spinner'
import { cn } from '@heroui/theme'
import { IS_PROD } from '@repo/env'
import { DefaultChatTransport, UIMessage } from 'ai'
import { useChat } from '@ai-sdk/react'
import Main from '@/components/ui/main'
import { ReactNode, memo, useRef, useState, useEffect, Suspense } from 'react'
import { toast } from 'sonner'
import { Streamdown } from 'streamdown'
import { ArrowCounterClockwiseIcon, ChatCircleDotsIcon, PaperPlaneRightIcon, PlusCircleIcon, StopCircleIcon, LightbulbIcon } from '@phosphor-icons/react'
import { ToolName, toolDescriptions, ToolResult } from './tool-types'

type MessagePart = UIMessage['parts'][number]

function ToolLoading({ toolName }: { toolName: ToolName }) {
    return (
        <div className='flex justify-center items-center gap-2 text-sm text-default-400 font-mono mt-2'>
            <Spinner size='sm' color='default' variant='dots' />
            <span>{toolDescriptions[toolName]}</span>
        </div>
    )
}

function ToolAccordian({ title, children, defaultExpanded, icon, ...props }: { title: string, children: ReactNode, icon: ReactNode, defaultExpanded?: boolean } & AccordionProps) {
    return <Accordion className='px-0 not-prose' {...props} defaultExpandedKeys={defaultExpanded ? ['content'] : []}>
        <AccordionItem key='content' title={title} startContent={icon} classNames={{
            titleWrapper: 'flex-none',
            trigger: 'text-sm py-2'
        }}>
            {children}
        </AccordionItem>
    </Accordion>
}

function ToolResultDisplay({ toolName, result }: { toolName: ToolName; result: Awaited<ToolResult[ToolName]> }) {
    switch (toolName) {

        default:
            return null
    }
}

function MessagePart({ part, isUser }: { part: MessagePart; isUser: boolean }) {
    if (part.type.startsWith('tool-')) {
        const toolName = part.type.substring(5) as ToolName
        const typedPart = part as any
        switch (typedPart.state) {
            case 'input-streaming':
            case 'input-available':
                return <ToolLoading toolName={toolName} />
            case 'output-available':
                return (
                    <div className='mt-2 w-full'>
                        <ToolResultDisplay
                            toolName={toolName}
                            result={typedPart.output as Awaited<ToolResult[ToolName]>}
                        />
                    </div>
                )
            case 'output-error':
                return <div className='font-mono text-sm'>Error: {typedPart.errorText}</div>
        }
    }

    switch (part.type) {
        case 'text':
            return (
                <div className={cn(
                    'px-4 py-3 mt-4 rounded-2xl max-w-4/5 text-base whitespace-pre-wrap overflow-x-hidden',
                    isUser
                        ? 'bg-default-50 text-default-900 dark:bg-stone-900'
                        : 'text-default-900 dark:bg-neutral-900',
                )}>
                    <Streamdown>{part.text}</Streamdown>
                </div>
            )
        case 'reasoning':
            return part.text && (
                <ToolAccordian defaultExpanded title='Reasoning' icon={<LightbulbIcon size={16} />}>
                    <Streamdown
                        className='prose dark:prose-invert max-w-none font-mono text-xs leading-tight'
                    >
                        {part.text}
                    </Streamdown>
                </ToolAccordian>
            )
        default:
            return <></>
    }
}

const MemoizedMessagePart = memo(MessagePart)

export function ChatMessage({
    message,
    regenerate,
    isLast,
    isLoading
}: {
    message: UIMessage,
    regenerate?: () => void,
    isLast?: boolean,
    isLoading?: boolean
}) {
    const { id, parts, role } = message

    const Parts = () => <>
        {parts?.map((part, j) => (
            <MemoizedMessagePart key={j} part={part as MessagePart} isUser={role === 'user'} />
        ))}
    </>

    return <div className={cn(
        'mb-4 flex flex-col',
        role === 'user' ? 'items-end' : 'items-start'
    )} data-message-id={id}>
        {
            isLast && regenerate ? (
                <div className='flex gap-1 justify-end items-end w-full'>
                    <Button
                        isIconOnly
                        variant='light'
                        size='sm'
                        radius='lg'
                        color='secondary'
                        isDisabled={isLoading}
                        className='text-default-500 shrink-0'
                        onPress={() => regenerate()}
                    >
                        <ArrowCounterClockwiseIcon className='text-secondary-300' size={16} />
                    </Button>
                    <Parts />
                </div>
            ) : <Parts />
        }
    </div>
}

const MemoizedMessage = memo(ChatMessage)

export const ChatMessages = ({
    regenerate,
    messages,
    isLoading
}: {
    regenerate?: () => void,
    messages: UIMessage[]
    isLoading?: boolean
}) => <>{messages.map((message, index) => <MemoizedMessage isLoading={isLoading} key={message.id} message={message} isLast={(index === messages.length - 1 || index === messages.length - 2) && message.role === 'user'} regenerate={regenerate} />)}</>

function ChatSession() {
    const inputRef = useRef<HTMLInputElement>(null)
    const [input, setInput] = useState('')
    const { messages, status, stop, setMessages, regenerate, sendMessage } = useChat({
        transport: new DefaultChatTransport({
            api: '/api/chat',
        }),
        onError: (error) => {
            if (IS_PROD) {
                toast.error('发生错误')
            } else {
                throw error
            }
        }
    })
    const isLoading = status === 'streaming' || status === 'submitted'
    const [isFirstConversation, setIsFirstConversation] = useState(true)

    const startNewConversation = (initialInput?: string) => {
        stop()
        setMessages([])
        setInput(isFirstConversation ? initialInput ?? '' : '')
        setIsFirstConversation(false)
    }

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return

        sendMessage({
            role: 'user',
            parts: [{ type: 'text', text: input }]
        })
        setInput('')
    }

    const handleButtonClick = () => {
        if (isLoading) {
            stop()
        } else {
            handleFormSubmit(new Event('submit') as unknown as React.FormEvent)
        }
    }

    return (
        <div className='flex flex-col h-full'>
            <div className={cn(
                'flex justify-between items-center mb-4 sticky py-2 pl-5 pr-1.5 sm:pl-7 sm:pr-3 top-4 z-10 rounded-full',
                'border border-slate-300/50 dark:border-stone-600/30',
                'backdrop-blur-xl backdrop-saturate-150',
            )}>
                <h2 className={'text-2xl bg-linear-to-r from-primary-800 to-primary-300 bg-clip-text text-transparent'}>
                    GemPen Your Paper
                </h2>
                <div className='flex items-center gap-0.5'>
                    <Button
                        radius='full'
                        color='primary'
                        variant='light'
                        startContent={<PlusCircleIcon />}
                        onPress={() => startNewConversation()}
                    >
                        新建对话
                    </Button>
                </div>
            </div>

            <ChatMessages isLoading={isLoading} messages={messages} regenerate={regenerate} />
            <form
                onSubmit={handleFormSubmit}
                className='flex items-center gap-2 mt-auto'
            >
                <Input
                    ref={inputRef}
                    className='flex-1'
                    value={input}
                    variant='flat'
                    onChange={e => setInput(e.target.value)}
                    autoComplete='off'
                    startContent={<ChatCircleDotsIcon className='text-default-500' />}
                />
                <Button
                    type='button'
                    color='primary'
                    isIconOnly
                    className='self-start'
                    isDisabled={status === 'ready' && !input.trim()}
                    aria-label={isLoading ? '停止' : '发送'}
                    onPress={handleButtonClick}
                    startContent={isLoading ? <StopCircleIcon size={22} /> : <PaperPlaneRightIcon size={22} />}
                ></Button>
            </form>
        </div>
    )
}

export default function ChatInterface() {
    return (
        <ChatSession />
    )
}
