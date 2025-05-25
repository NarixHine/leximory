'use client'

import { useChat } from '@ai-sdk/react'
import { useAtom } from 'jotai'
import { messagesAtom } from '../atoms'
import { PiPaperPlaneRightFill, PiSpinnerGap, PiChatCircleDotsDuotone, PiPlusCircleDuotone, PiStopCircleDuotone, PiClockClockwiseDuotone, PiSparkleDuotone, PiExamDuotone, PiPencilCircleDuotone } from 'react-icons/pi'
import { useRef } from 'react'
import Markdown from '@/components/markdown'
import { cn } from '@/lib/utils'
import { Card, CardBody } from '@heroui/card'
import { Button } from '@heroui/button'
import { Textarea } from '@heroui/input'
import { chatFontFamily, postFontFamily } from '@/lib/fonts'
import type { ToolResult, ToolName } from '../types'
import Main from '@/components/ui/main'
import LibraryComponent from '@/app/library/components/lib'
import TextComponent from '@/app/library/[lib]/components/text'
import { Spinner } from '@heroui/spinner'
import { toast } from 'sonner'
import { Accordion, AccordionItem } from '@heroui/react'
import UpgradeMessage from './upgrade-message'
import type { Plan } from '@/server/auth/quota'
import { isProd } from '@/lib/env'

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

function ToolResult({ toolName, result }: { toolName: ToolName; result: Awaited<ToolResult[ToolName]> }) {
    switch (toolName) {
        case 'listLibs':
            return (
                <ul className='mt-2 flex flex-col gap-2'>
                    {(result as Awaited<ToolResult['listLibs']>).map(({ lib }) => (
                        <li className='font-mono text-sm text-default-500' key={lib.id}>
                            {lib.name} — {lib.lang}
                        </li>
                    ))}
                </ul>
            )

        case 'getLib':
            const lib = result as Awaited<ToolResult['getLib']>
            return (
                <div className='mt-2'>
                    <LibraryComponent
                        id={lib.id}
                        name={lib.name}
                        lang={lib.lang}
                        isOwner={false}
                        access={lib.access}
                        orgId={null}
                        shadow={false}
                        orgs={[]}
                        price={0}
                        archived
                        isStarred={false}
                    />
                </div>
            )

        case 'getAllTextsInLib':
        case 'getTexts':
            return (
                <div className='mt-2 grid grid-cols-1 md:grid-cols-2 gap-5'>
                    {(result as Awaited<ToolResult['getAllTextsInLib']>).map((text) => (
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
            const text = result as Awaited<ToolResult['getTextContent']>
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
                    'px-4 py-3 mt-4 rounded-2xl max-w-[80%] text-base whitespace-pre-wrap',
                    isUser
                        ? 'bg-secondary-50/50 text-default-900'
                        : 'bg-primary-50/50 text-default-900'
                )}>
                    {part.text ? <Markdown
                        fontFamily={chatFontFamily}
                        md={part.text}
                        className='prose dark:prose-invert max-w-none'
                        hasWrapped={true}
                    /> : <Spinner className='w-4 h-4' />}
                </div>
            )
        case 'reasoning':
            return (
                <Accordion className='mt-2' defaultExpandedKeys={['reasoning']}>
                    <AccordionItem key={'reasoning'} title={part.text || ''}>
                        <Markdown
                            fontFamily={chatFontFamily}
                            md={part.text || ''}
                            className='prose dark:prose-invert max-w-none'
                        />
                    </AccordionItem>
                </Accordion>
            )
        case 'tool-invocation':
            if (part.toolInvocation?.state === 'result' && part.toolInvocation.result) {
                return (
                    <div className='mt-2 w-full'>
                        <ToolResult
                            toolName={part.toolInvocation.toolName as ToolName}
                            result={part.toolInvocation.result as Awaited<ToolResult[ToolName]>}
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

const initialPrompts = [ {
        title: '高分语块',
        prompt: '对于文库【文库名称】中的文章，提取出适合用在作文里的高分词汇和词组，量少而精。',
        icon: PiSparkleDuotone
    }, {
        title: '本周复习',
        prompt: '这周我学习了哪些新单词？找出这些单词，用相应的语言生成一个小故事供我复习。',
        icon: PiClockClockwiseDuotone
    }, {
        title: '实战训练',
        prompt: '根据文章【文章标题】，提炼出可以运用于以下作文的语块，然后给出范文。',
        icon: PiExamDuotone
    }, {
        title: '造句巩固',
        prompt: '针对这周学习的新单词，选出几个单词，对每个单词用中文出一道翻译题，考察我对单词用法的掌握。',
        icon: PiPencilCircleDuotone
    }
]

export default function ChatInterface({ plan }: { plan: Plan }) {
    const [messages, setMessages] = useAtom(messagesAtom)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const { messages: aiMessages, input, setInput, handleSubmit, status, setData, stop, setMessages: setAiMessages} = useChat({
        api: '/api/library/chat',
        initialMessages: messages,
        onFinish: (message) => {
            setMessages([...aiMessages, message])
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        },
        onError: () => {
            toast.error('发生错误')
        }
    })

    const startNewConversation = () => {
        setMessages([])
        setAiMessages([])
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

    const handlePromptClick = (prompt: string) => {
        setInput(prompt)
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
            {plan === 'beginner' && <UpgradeMessage />}
            {messages.length === 0 && (
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-8'>
                    {initialPrompts.map((prompt, index) => (
                        <Card
                            key={index}
                            isPressable
                            onPress={() => handlePromptClick(prompt.prompt)}
                            className='bg-primary-50/20 hover:bg-primary-50/30 transition-colors'
                            shadow='none'
                        >
                            <CardBody>
                                <div className='flex items-start gap-3'>
                                    <div className='p-2 rounded-full bg-primary-100/50'>
                                        <prompt.icon className='text-primary' size={20} />
                                    </div>
                                    <div>
                                        <h3 className='text-lg font-medium'>{prompt.title}</h3>
                                        <p className='text-sm text-default-500'>{prompt.prompt}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}
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
                    maxRows={15}
                    autoComplete='off'
                    startContent={<PiChatCircleDotsDuotone className='text-default-500 mt-0.5' />}
                />
                <Button
                    type='button'
                    color='primary'
                    isIconOnly
                    className='self-start'
                    isDisabled={(plan === 'beginner' && isProd) || (status !== 'streaming' && !input.trim())}
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