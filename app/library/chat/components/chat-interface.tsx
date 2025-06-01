'use client'

import { Message, useChat } from '@ai-sdk/react'
import { useAtom } from 'jotai'
import { messagesAtom } from '../atoms'
import { PiPaperPlaneRightFill, PiChatCircleDotsDuotone, PiPlusCircleDuotone, PiStopCircleDuotone, PiClockClockwiseDuotone, PiSparkleDuotone, PiExamDuotone, PiPencilCircleDuotone, PiCopy, PiCheck, PiPackage, PiBooks, PiPaperclipFill, PiPaperclipDuotone, PiNewspaperClippingDuotone, PiNewspaperDuotone, PiLightbulb, PiEmpty, PiBookmark, PiCopyDuotone } from 'react-icons/pi'
import { useEffect, useRef, useState } from 'react'
import Markdown from '@/components/markdown'
import { cn } from '@/lib/utils'
import { Card, CardBody } from '@heroui/card'
import { Button } from '@heroui/button'
import { Textarea } from '@heroui/input'
import { contentFontFamily } from '@/lib/fonts'
import type { ToolResult, ToolName } from '../types'
import Main from '@/components/ui/main'
import LibraryComponent from '@/app/library/components/lib'
import { Spinner } from '@heroui/spinner'
import { toast } from 'sonner'
import { Accordion, AccordionItem } from '@heroui/react'
import UpgradeMessage from './upgrade-message'
import type { Plan } from '@/server/auth/quota'
import { isProd } from '@/lib/env'
import H from '@/components/ui/h'
import { useCopyToClipboard } from 'usehooks-ts'
import Text from '@/app/library/[lib]/components/text'
import { ScopeProvider } from 'jotai-scope'
import { libAtom } from '../../[lib]/atoms'
import { HydrationBoundary } from 'jotai-ssr'
import Paper from '@/components/editory/paper'
import { toolDescriptions } from '../types'
import { useLogSnag } from '@logsnag/next'

const initialPrompts = [{
    title: '注解段落',
    prompt: '注解以下段落，无需保存。\n',
    icon: PiNewspaperClippingDuotone
}, {
    title: '注解文章',
    prompt: '注解下文并存入【词汇仓库】文库。\n',
    icon: PiNewspaperDuotone
}, {
    title: '高分语块',
    prompt: '对于文库【文库名称】中的【所有】文章，提取出适合用在作文里的高分词汇和词组，量少而精。',
    icon: PiSparkleDuotone
}, {
    title: '本周复习',
    prompt: '【本周】我学习了哪些新单词？找出这些单词，用相应的语言生成一个小故事供我加深印象。',
    icon: PiClockClockwiseDuotone
}, {
    title: '实战训练',
    prompt: '对于以下作文，尽可能多地使用文库【文库名称】里文章中的语块，给出范文。',
    icon: PiExamDuotone
}, {
    title: '造句巩固',
    prompt: '针对【今天】学习的【英语】单词，选出几个单词，对每个单词用中文出一道翻译题，考察我的掌握。',
    icon: PiPencilCircleDuotone
}] as const

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

function ToolState({ state, toolName }: { state: string; toolName: ToolName }) {
    console.log(state, toolName)
    if (state === 'call') {
        return (
            <div className='flex items-center gap-2 text-sm text-default-400 font-mono mt-2'>
                <Spinner size='sm' color='default' variant='spinner' />
                <span>{toolDescriptions[toolName]}</span>
            </div>
        )
    }
    return <></>
}

function ToolResult({ toolName, result }: { toolName: ToolName; result: Awaited<ToolResult[ToolName]> }) {
    const [, copy] = useCopyToClipboard()
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const handleCopy = async (text: string, id: string) => {
        await copy(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 1000)
    }

    switch (toolName) {
        case 'listLibs':
            return (
                <ul className='mt-2 flex flex-col gap-1'>
                    <span className='text-sm text-default-700 font-mono flex gap-3 items-center'><PiBooks /> All Libraries</span>
                    {(result as Awaited<ToolResult['listLibs']>).map(({ lib }) => (
                        <li className='font-mono text-sm text-default-500 flex gap-2 items-center' key={lib.id}>
                            {lib.name} — {lib.lang}
                            <Button
                                variant='light'
                                size='sm'
                                className='text-default-700 size-5'
                                isIconOnly
                                startContent={copiedId === lib.id ? <PiCheck /> : <PiCopy />}
                                onPress={() => handleCopy(lib.name, lib.id)}
                            />
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
            const res = result as Awaited<ToolResult['getAllTextsInLib']>
            return (
                <ul className='mt-2 flex flex-col gap-1'>
                    <span className='text-sm text-default-700 font-mono flex gap-3 items-center'><PiPackage /> Library - {res[0].libName}</span>
                    {res.map((text, index) => (
                        <li className='font-mono text-sm text-default-500 flex gap-2 items-center' key={text.id}>
                            {index + 1}. {text.title}
                            <Button
                                variant='light'
                                size='sm'
                                className='text-default-700 size-5'
                                isIconOnly
                                startContent={copiedId === text.id ? <PiCheck /> : <PiCopy />}
                                onPress={() => handleCopy(text.title, text.id)}
                            />
                        </li>
                    ))}
                </ul>
            )

        case 'getTextContent':
            const text = result as Awaited<ToolResult['getTextContent']>
            return (
                <Card className='mt-2 bg-primary-50/20 dark:bg-default-50/20' shadow='none' isBlurred>
                    <CardBody className='p-6'>
                        <div className='text-2xl mb-2' style={{ fontFamily: contentFontFamily }}>{text.title}</div>
                        <div className='text-default-600 dark:text-default-400'>
                            <Markdown disableSave md={text.content} className='prose dark:prose-invert max-w-none' fontFamily={contentFontFamily} />
                        </div>
                    </CardBody>
                </Card>
            )
        case 'annotateParagraph':
            return (
                <Card className='mt-2 bg-primary-50/20' shadow='none' isBlurred>
                    <CardBody className='p-6'>
                        <div className='text-default-600 dark:text-default-400'>
                            <Markdown disableSave md={result as Awaited<ToolResult['annotateParagraph']>} className='prose dark:prose-invert max-w-none' fontFamily={contentFontFamily} />
                        </div>
                    </CardBody>
                </Card>
            )

        case 'annotateArticle':
            const { id, title, updatedAt, createdAt, libId } = result as ToolResult['annotateArticle']
            return (
                <div className='mt-2 flex flex-col gap-2 mb-1'>
                    <span className='text-sm text-default-400'>注解完成后会显示在文本中</span>
                    <ScopeProvider atoms={[libAtom]}>
                        <HydrationBoundary hydrateAtoms={[[libAtom, libId]]}>
                            <Text
                                id={id}
                                title={title}
                                topics={[]}
                                hasEbook={false}
                                createdAt={createdAt}
                                updatedAt={updatedAt}
                            />
                        </HydrationBoundary>
                    </ScopeProvider>
                </div>
            )

        case 'getForgetCurve':
            const words = (result as Awaited<ToolResult['getForgetCurve']>).flat()
            return (
                <div className={cn('mt-2 gap-2', words.length > 0 ? 'flex flex-col' : 'flex items-center')}>
                    <span className='text-sm text-default-600 font-mono flex items-center gap-3'><PiBookmark />Words to review</span>
                    {
                        words.length > 0
                            ? <ul className='flex flex-wrap gap-2'>
                                {words.map(({ id, word }) => (
                                    <li className=' flex gap-1 items-center' key={id}>
                                        <Markdown disableSave deleteId={id} md={word} className='!font-mono prose-sm leading-none opacity-60' />
                                    </li>
                                ))}
                            </ul>
                            : <span className='text-sm text-default-400 font-mono'><PiEmpty /></span>
                    }
                </div>
            )

        case 'generateQuiz':
            const quiz = result as ToolResult['generateQuiz']
            return (
                <Card className='mt-2 bg-primary-50/20 dark:bg-default-50/20' shadow='none' isBlurred>
                    <CardBody className='p-6'>
                        <Paper data={[quiz]} />
                    </CardBody>
                </Card>
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
                        disableSave
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
                            disableSave
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
                    <ToolState state={part.toolInvocation?.state || ''} toolName={part.toolInvocation?.toolName as ToolName} />
                </div>
            )
        case 'step-start':
            return (
                <div className='mt-4'>
                    <span className='text-sm text-default-600 font-mono flex items-center gap-2'><PiLightbulb className='animate-spin' size={16} /> Thinking ...</span>
                </div>
            )
        default:
            return <></>
    }
}

export function ChatMessages({ messages }: { messages: Message[] }) {
    return <>{
        messages.map(({ parts, role, experimental_attachments }, i) => (
            <div style={{ fontFamily: contentFontFamily }} key={i} className={cn(
                'mb-4 flex flex-col',
                role === 'user' ? 'items-end' : 'items-start'
            )}>
                {experimental_attachments && experimental_attachments.length > 0 && (
                    <div className='flex flex-col gap-2'>
                        {experimental_attachments.map((att, idx) => (
                            <div
                                key={idx}
                                className='flex items-center gap-2 p-2 rounded bg-primary-50/40 border border-primary-100'
                            >
                                <PiPaperclipFill className='text-primary-500' size={20} />
                                <span className='text-sm text-default-700 truncate max-w-[180px] sm:max-w-[240px] md:max-w-[400px]' title={att.name}>
                                    {att.name}
                                </span>
                                <a
                                    href={att.url}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='text-primary-600 underline text-xs'
                                    download={att.name}
                                >
                                    下载
                                </a>
                            </div>
                        ))}
                    </div>
                )}
                {parts?.map((part, j) => (
                    <MessagePart key={j} part={part as MessagePart} isUser={role === 'user'} />
                ))}
            </div>
        ))
    }</>
}

export default function ChatInterface({ plan, initialPromptIndex }: { plan: Plan, initialPromptIndex: number | null }) {
    const [storedMessages, setStoredMessages] = useAtom(messagesAtom)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [files, setFiles] = useState<FileList | undefined>(undefined)
    const { messages, input, setInput, handleSubmit, status, setData, stop, setMessages } = useChat({
        api: '/api/library/chat',
        initialMessages: storedMessages,
        onFinish: () => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            setFiles(undefined)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        },
        onToolCall() {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        },
        onResponse: () => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        },
        onError: () => {
            toast.error('发生错误')
            setFiles(undefined)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        },
        initialInput: initialPromptIndex ? initialPrompts[initialPromptIndex].prompt : undefined
    })

    const { track } = useLogSnag()

    useEffect(() => {
        if (messages.length > 0) {
            setStoredMessages(messages)
        }
    }, [messages])

    const startNewConversation = () => {
        setStoredMessages([])
        setMessages([])
        setInput('')
        setData([])
        track({
            event: '开始新对话',
            channel: 'agent',
            description: `新建了一条与 AI 的对话`,
            icon: '🆕',
        })
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(e.target.files)
        }
    }

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || status === 'streaming') return

        handleSubmit(e, {
            experimental_attachments: files
        })
        setInput('')

        track({
            event: '发送消息',
            channel: 'agent',
            description: `向 AI 发送了一条指令`,
            icon: '💬',
        })
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

    const [, copy] = useCopyToClipboard()

    return (
        <Main style={{ fontFamily: contentFontFamily }} className='flex flex-col max-w-2xl'>
            <div className='flex justify-between items-center mb-4 sticky p-2 top-10 z-10 backdrop-blur bg-background/50'>
                <H usePlayfair className={'text-3xl bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent'}>
                    Talk to Your Library
                </H>
                <div className='flex items-center gap-2'>
                    {!isProd && (<Button
                        color='primary'
                        variant='light'
                        startContent={<PiCopyDuotone />}
                        onPress={() => {
                            copy(JSON.stringify(messages))
                            toast.success('已复制到剪贴板')
                        }}
                        isIconOnly
                    ></Button>)}
                    <Button
                        color='primary'
                        variant='light'
                        startContent={<PiPlusCircleDuotone />}
                        onPress={startNewConversation}
                    >
                        开始新对话
                    </Button>
                </div>
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
            <ChatMessages messages={messages} />
            <div ref={messagesEndRef} />
            <form
                onSubmit={handleFormSubmit}
                className='flex items-center gap-2'
            >
                <input
                    type='file'
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className='hidden'
                    accept='.pdf,.txt,.md'
                />
                <Textarea
                    className='flex-1'
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder='输入你的问题...'
                    disabled={status === 'streaming'}
                    maxRows={15}
                    autoComplete='off'
                    startContent={
                        <div className='flex items-center gap-2'>
                            <PiChatCircleDotsDuotone className='text-default-500 mt-0.5' />
                        </div>
                    }
                />
                <Button
                    type='button'
                    color='primary'
                    variant='light'
                    isIconOnly
                    className='self-start'
                    startContent={
                        files && files.length > 0 ? <PiPaperclipFill size={22} /> : <PiPaperclipDuotone size={22} />
                    }
                    onPress={() => fileInputRef.current?.click()}
                ></Button>
                <Button
                    type='button'
                    color='primary'
                    isIconOnly
                    className='self-start'
                    isDisabled={(plan === 'beginner' && isProd) || (status !== 'streaming' && !input.trim())}
                    aria-label={status === 'streaming' ? '停止' : '发送'}
                    onPress={handleButtonClick}
                    startContent={status === 'streaming' ? <PiStopCircleDuotone size={22} /> : <PiPaperPlaneRightFill size={22} />}
                ></Button>
            </form>
        </Main>
    )
} 