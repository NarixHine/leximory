'use client'

import { Button } from '@heroui/button'
import { Textarea } from '@heroui/input'
import { Spinner } from '@heroui/spinner'
import { cn } from '@heroui/theme'
import { IS_PROD } from '@repo/env'
import { DefaultChatTransport, ToolCallPart, UIMessage } from 'ai'
import { useChat } from '@ai-sdk/react'
import { memo, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Streamdown } from 'streamdown'
import { ArrowCounterClockwiseIcon, ChatCircleDotsIcon, PaperPlaneRightIcon, StopCircleIcon, WarningCircleIcon, NavigationArrowIcon, ArrowsClockwiseIcon } from '@phosphor-icons/react'
import { ToolName, toolDescriptions, ToolResult, toolSchemas } from './tool-types'
import { useAtom } from 'jotai'
import { editoryItemsAtom } from '@repo/ui/paper/atoms'
import { nanoid } from 'nanoid'
import { ProtectedButton } from '@repo/ui/protected-button'

type MessagePart = UIMessage['parts'][number]

function ToolMessageWrapper({ children }: { children: React.ReactNode }) {
    return <div className='flex items-center gap-2 text-default-600 ml-2'>
        {children}
    </div>
}

function ToolLoading({ toolName }: { toolName: ToolName }) {
    return (
        <ToolMessageWrapper>
            <Spinner size='sm' color='default' variant='dots' />
            <span>{toolDescriptions[toolName].loading}</span>
        </ToolMessageWrapper>
    )
}


function ToolResultDisplay({ toolName }: { toolName: ToolName; result: Awaited<ToolResult[ToolName]> }) {
    return (
        <ToolMessageWrapper>
            <NavigationArrowIcon size={16} />
            {toolDescriptions[toolName].completed}
        </ToolMessageWrapper>
    )
}

function MessagePart({ part, isUser }: { part: MessagePart; isUser: boolean }) {
    function isToolPart(part: any): part is ToolCallPart {
        return part.type.startsWith('tool-')
    }
    if (isToolPart(part)) {
        const toolName = part.type.substring(5) as ToolName
        const typedPart = part
        switch (typedPart.state) {
            case 'input-streaming':
            case 'input-available':
                return <ToolLoading toolName={toolName} />
            case 'output-available':
                return (
                    <ToolResultDisplay
                        toolName={toolName}
                        result={typedPart.output as Awaited<ToolResult[ToolName]>}
                    />
                )
            case 'output-error':
                return <ToolMessageWrapper>
                    <WarningCircleIcon size={16} /> Error
                </ToolMessageWrapper>
        }
    }

    switch (part.type) {
        case 'text':
            return (
                <div className={cn(
                    'rounded-2xl max-w-4/5 prose overflow-x-hidden',
                    isUser
                        ? 'bg-default-50 text-default-900 dark:bg-stone-900 px-6'
                        : 'text-default-900 px-4',
                )}>
                    <Streamdown>{part.text}</Streamdown>
                </div>
            )
        case 'reasoning':
            return part.text && (
                <Streamdown
                    className='prose dark:prose-invert max-w-none font-mono text-xs leading-tight'
                >
                    {part.text}
                </Streamdown>
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

    const content = parts.map((part, j) => (
        <MemoizedMessagePart key={j} part={part as MessagePart} isUser={role === 'user'} />
    ))

    return <div className={cn(
        'mb-8 flex flex-col',
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
                    {content}
                </div>
            ) : content
        }
    </div>
}

const MemoizedMessage = memo(ChatMessage)

export const ChatMessages = ({
    messages,
    isLoading
}: {
    messages: UIMessage[]
    isLoading?: boolean
}) => <>{messages.map((message, index) => <MemoizedMessage isLoading={isLoading} key={message.id} message={message} isLast={(index === messages.length - 1 || index === messages.length - 2) && message.role === 'user'} />)}</>

function ChatSession() {
    const [data, setData] = useAtom(editoryItemsAtom)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const [input, setInput] = useState('读取以下链接内的外刊出成完形填空\n')
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.setSelectionRange(input.length, input.length)
        }
    }, [])
    const { messages, status, stop, setMessages, sendMessage, addToolOutput } = useChat({
        transport: new DefaultChatTransport({
            api: '/api/chat',
            body: { currentItems: data },
        }),
        onToolCall: async ({ toolCall }) => {
            if (toolCall.dynamic) return

            switch (toolCall.toolName) {
                case 'getCurrentItems':
                    addToolOutput({
                        tool: 'getCurrentItems',
                        toolCallId: toolCall.toolCallId,
                        output: JSON.stringify(data),
                    })
                    break
                case 'addQuizItem':
                    const input1 = toolSchemas.addQuizItem.safeParse(toolCall.input)
                    if (input1.success) {
                        const { data } = input1
                        const newItem = { id: nanoid(8), ...data }
                        setData(prev => [...prev, newItem])
                        addToolOutput({
                            tool: 'addQuizItem',
                            toolCallId: toolCall.toolCallId,
                            output: JSON.stringify({ success: true, id: newItem.id }),
                        })
                    }
                    else {
                        addToolOutput({
                            tool: 'addQuizItem',
                            toolCallId: toolCall.toolCallId,
                            output: JSON.stringify({ success: false, error: input1.error.message }),
                        })
                        throw new Error(input1.error.message)
                    }
                    break
                case 'removeQuizItem':
                    const input2 = toolSchemas.removeQuizItem.safeParse(toolCall.input)
                    if (input2.success) {
                        const { id: removeId } = input2.data
                        setData(prev => prev.filter(item => item.id !== removeId))
                        addToolOutput({
                            tool: 'removeQuizItem',
                            toolCallId: toolCall.toolCallId,
                            output: JSON.stringify({ success: true }),
                        })
                    }
                    else {
                        addToolOutput({
                            tool: 'removeQuizItem',
                            toolCallId: toolCall.toolCallId,
                            output: JSON.stringify({ success: false, error: input2.error.message }),
                        })
                        throw new Error(input2.error.message)
                    }
                    break
                case 'updateQuizItem':
                    const input3 = toolSchemas.updateQuizItem.safeParse(toolCall.input)
                    if (input3.success) {
                        const { id: updateId, data: updateData } = input3.data
                        setData(prev => prev.map(item => item.id === updateId ? { ...item, ...updateData } : item))
                        addToolOutput({
                            tool: 'updateQuizItem',
                            toolCallId: toolCall.toolCallId,
                            output: JSON.stringify({ success: true }),
                        })
                    }
                    else {
                        addToolOutput({
                            tool: 'updateQuizItem',
                            toolCallId: toolCall.toolCallId,
                            output: JSON.stringify({ success: false, error: input3.error.message }),
                        })
                        throw new Error(input3.error.message)
                    }
                    break
            }
        },
        onError: (error) => {
            if (IS_PROD) {
                toast.error('发生错误')
            } else {
                toast.error(error.message)
                console.error(error)
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
        <div className='flex flex-col flex-1'>
            <div className={cn(
                'flex justify-between items-center mb-4 sticky py-2 pl-5 pr-2 top-4 z-10 rounded-lg',
                'border border-slate-300/50 dark:border-stone-600/30',
                'backdrop-blur backdrop-saturate-150',
            )}>
                <h2 className={'text-2xl font-formal'}>
                    <span className='italic'>PouncePen</span> your paper.
                </h2>
                <Button
                    radius='sm'
                    color='primary'
                    variant='light'
                    startContent={<ArrowsClockwiseIcon />}
                    onPress={() => startNewConversation()}
                >
                    重开对话
                </Button>
            </div>

            <ChatMessages isLoading={isLoading} messages={messages} />
            <form
                onSubmit={handleFormSubmit}
                className='flex items-center gap-2 mt-auto'
            >
                <Textarea
                    autoFocus
                    ref={inputRef}
                    className='flex-1'
                    value={input}
                    color='primary'
                    variant='flat'
                    onChange={e => setInput(e.target.value)}
                    autoComplete='off'
                    startContent={<ChatCircleDotsIcon className='text-default-500' />}
                />
                <ProtectedButton
                    type='button'
                    color='primary'
                    isIconOnly
                    className='self-start'
                    isDisabled={status === 'ready' && !input.trim()}
                    aria-label={isLoading ? '停止' : '发送'}
                    onPress={handleButtonClick}
                    startContent={isLoading ? <StopCircleIcon size={22} /> : <PaperPlaneRightIcon size={22} />}
                ></ProtectedButton>
            </form>
        </div>
    )
}

export default function ChatInterface() {
    return (
        <ChatSession />
    )
}
