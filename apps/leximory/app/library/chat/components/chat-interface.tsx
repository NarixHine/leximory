'use client'

import { UIMessage as Message, useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useAtom } from 'jotai'
import { messagesAtom } from '../atoms'
import { PiPaperPlaneRightFill, PiChatCircleDots, PiPlusCircle, PiStopCircle, PiSparkle, PiPencilCircle, PiCopy, PiCheck, PiPackage, PiBooks, PiPaperclipFill, PiPaperclip, PiNewspaperClipping, PiNewspaper, PiLightbulb, PiEmpty, PiBookmark, PiLinkSimple, PiLockSimple, PiBookmarks, PiArrowCounterClockwise, PiFolderOpen } from 'react-icons/pi'
import { memo, ReactNode, Suspense, useEffect, useRef, useState } from 'react'
import Markdown from '@/components/markdown'
import { cn } from '@/lib/utils'
import { Card, CardBody } from '@heroui/card'
import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import type { ToolResult, ToolName } from '../types'
import Main from '@/components/ui/main'
import LibraryComponent from '@/app/library/components/lib'
import { Spinner } from '@heroui/spinner'
import { toast } from 'sonner'
import { Accordion, AccordionItem, AccordionProps } from '@heroui/react'
import { IS_PROD } from '@repo/env'
import H from '@/components/ui/h'
import { useCopyToClipboard } from 'usehooks-ts'
import Text from '@/app/library/[lib]/components/text'
import { ScopeProvider } from 'jotai-scope'
import { langAtom, libAtom } from '../../[lib]/atoms'
import { HydrationBoundary } from 'jotai-ssr'
import { toolDescriptions } from '../types'
import { StreakMemoryDraft } from './streak-memory-draft'

const initialPrompts = [{
    title: '近日造句巩固',
    prompt: '针对［近两日］学习的［英语］单词，选出几个语块，总共出三道翻译题，考察并巩固我的掌握。',
    icon: PiPencilCircle
}, {
    title: '本周造句巩固',
    prompt: '针对［本周］学习的［英语］单词，选出几个语块，总共出六道翻译题，考察并巩固我的掌握。',
    icon: PiBookmarks
}, {
    title: '金句提取',
    prompt: '提取［文库名称］中的［所有］文章里可借鉴于作文中的高分金句。',
    icon: PiSparkle
}, {
    title: '导入网页',
    prompt: '提取以下网页中的文章，并导入［词汇仓库］文库。',
    icon: PiLinkSimple
}, {
    title: '注解段落',
    prompt: '注解以下段落，无需保存。',
    icon: PiNewspaperClipping
}, {
    title: '注解文章',
    prompt: '注解下文并存入［词汇仓库］文库。',
    icon: PiNewspaper
}] as const

type MessagePart = {
    type: 'text' | 'reasoning' | `tool-${string}` | 'source' | 'step-start' | 'tool-result'
    text?: string
    toolName?: string
    toolCallId?: string
    state?: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
    result?: any
    toolInvocation?: {
        state: string
        step: number
        toolCallId: string
        toolName: string
        args: any
        result: any
    }
    input?: any
    output?: any
    errorText?: string
}

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
                <ToolAccordian title='All Libraries' icon={<PiBooks />}>
                    <ul className='flex flex-col gap-1'>
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
                </ToolAccordian>
            )

        case 'getLib':
            const lib = result as Awaited<ToolResult['getLib']>
            return (
                <ToolAccordian title={`Library — ${lib.name}`} icon={<PiBooks />}>
                    <LibraryComponent
                        id={lib.id}
                        name={lib.name}
                        lang={lib.lang}
                        isOwner={false}
                        access={lib.access}
                        shadow={lib.shadow}
                        price={0}
                        archived
                        isStarred={false}
                    />
                </ToolAccordian>
            )

        case 'getAllTextsInLib':
        case 'getTexts':
            const res = result as Awaited<ToolResult['getTexts']>
            const libName = res[0]?.libName
            return (
                <ToolAccordian title={`Texts${libName ? ` In ${libName}` : ''}`} icon={<PiPackage />}>
                    <ul className='flex flex-col gap-1'>
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
                </ToolAccordian>
            )

        case 'getTextContent':
        case 'extractArticleFromWebpage':
            const { title: articleTitle, content: articleContent } = result as Awaited<ToolResult['extractArticleFromWebpage']> | Awaited<ToolResult['getTextContent']>
            return (
                <ToolAccordian title={articleTitle} icon={<PiNewspaper />}>
                    <Card className='bg-primary-50/20 dark:bg-default-50/40' shadow='none' isBlurred>
                        <CardBody className='p-6'>
                            <div className='text-default-600 dark:text-default-400'>
                                <Markdown md={articleContent} className='prose dark:prose-invert max-w-none' />
                            </div>
                        </CardBody>
                    </Card>
                </ToolAccordian>
            )

        case 'annotateParagraph':
            const { annotation, lang } = result as ToolResult['annotateParagraph']
            return (
                <Card className='bg-primary-50/20 dark:bg-default-50/40' shadow='none' isBlurred>
                    <CardBody className='p-6'>
                        <div className='text-default-600 dark:text-default-400'>
                            <ScopeProvider atoms={[langAtom]}>
                                <HydrationBoundary hydrateAtoms={[[langAtom, lang]]}>
                                    <Markdown md={annotation} className='prose dark:prose-invert max-w-none' />
                                </HydrationBoundary>
                            </ScopeProvider>
                        </div>
                    </CardBody>
                </Card>
            )

        case 'annotateArticle':
            const { id, title, createdAt, libId } = result as ToolResult['annotateArticle']
            return (
                <ToolAccordian defaultExpanded title={`Article Created`} icon={<PiNewspaper />}>
                    <div className='flex flex-col gap-2 mb-1'>
                        <span className='text-sm font-semibold text-default-400'>注解完成后会显示在文本中</span>
                        <ScopeProvider atoms={[libAtom]}>
                            <HydrationBoundary hydrateAtoms={[[libAtom, libId]]}>
                                <Text
                                    id={id}
                                    title={title}
                                    topics={[]}
                                    hasEbook={false}
                                    createdAt={createdAt}
                                    visitStatus={'not-visited'}
                                    disablePrefetch
                                />
                            </HydrationBoundary>
                        </ScopeProvider>
                    </div>
                </ToolAccordian>
            )

        case 'getForgetCurve':
            const words = result as Awaited<ToolResult['getForgetCurve']>
            return (
                <ToolAccordian title='Words to Review' icon={<PiBookmark />}>
                    <div className={cn('gap-2', words.length > 0 ? 'flex flex-col' : 'flex items-center')}>
                        {
                            words.length > 0
                                ? <ul className='flex flex-wrap gap-2'>
                                    {words.map(({ id, word, lang, lib }) => (
                                        <li className=' flex gap-1 items-center' key={id}>
                                            <ScopeProvider atoms={[langAtom, libAtom]}>
                                                <HydrationBoundary hydrateAtoms={[[langAtom, lang], [libAtom, lib]]}>
                                                    <Markdown deleteId={id} md={word} className='font-mono! prose-sm leading-none opacity-60' />
                                                </HydrationBoundary>
                                            </ScopeProvider>
                                        </li>
                                    ))}
                                </ul>
                                : <span className='text-sm text-default-400 font-mono'><PiEmpty /></span>
                        }
                    </div>
                </ToolAccordian>
            )

        case 'requestPublishStreakMemory':
            const { content, user } = result as ToolResult['requestPublishStreakMemory']
            return <StreakMemoryDraft content={content} user={user} />

        default:
            return null
    }
}

function MessagePart({ part, isUser }: { part: MessagePart; isUser: boolean }) {
    if (part.type.startsWith('tool-')) {
        const toolName = part.type.substring(5) as ToolName
        switch (part.state) {
            case 'input-streaming':
            case 'input-available':
                return <ToolLoading toolName={toolName} />
            case 'output-available':
                return (
                    <div className='mt-2 w-full'>
                        <ToolResult
                            toolName={toolName}
                            result={part.output as Awaited<ToolResult[ToolName]>}
                        />
                    </div>
                )
            case 'output-error':
                return <div className='font-mono text-sm'>Error: {part.errorText}</div>
        }
    }

    switch (part.type) {
        case 'text':
            return (
                <div className={cn(
                    'px-4 py-3 mt-4 rounded-4xl max-w-4/5 text-base whitespace-pre-wrap overflow-x-hidden',
                    isUser
                        ? 'bg-default-50'
                        : 'bg-secondary-50',
                )}>
                    {part.text ? <Markdown
                        md={part.text}
                        className='prose dark:prose-invert max-w-none'
                        hasWrapped={true}
                    /> : <Spinner className='w-4 h-4' />}
                </div>
            )
        case 'reasoning':
            return part.text && (
                <ToolAccordian defaultExpanded title='Reasoning' icon={<PiLightbulb size={16} />}>
                    <Markdown
                        compact
                        md={part.text}
                        className='prose dark:prose-invert max-w-none font-mono text-xs leading-tight'
                    />
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
    message: Message,
    regenerate?: () => void,
    isLast?: boolean,
    isLoading?: boolean
}) {
    const { id, parts, role } = message

    const Parts = parts.map((part, j) => (
        <MemoizedMessagePart key={j} part={part as MessagePart} isUser={role === 'user'} />
    ))

    return <div className={cn(
        'mb-4 flex flex-col',
        role === 'user' ? 'items-end' : 'items-start'
    )} data-message-id={id}>
        {parts?.map((part, index) => {
            if (part.type === 'file' && part.mediaType?.startsWith('image/')) {
                return (
                    <div key={index}>
                        <img src={part.url} alt='Appended Image' />
                    </div>
                )
            }
            if (part.type === 'file') {
                return (
                    <div
                        key={index}
                        className='flex items-center gap-2 p-2 rounded bg-primary-50/40 border border-primary-100'
                    >
                        <PiPaperclipFill className='text-primary-500' size={20} />
                        <span className='text-sm text-default-700 truncate max-w-45 sm:max-w-60 md:max-w-100' title={part.url}>
                            {part.url.split('/').pop()}
                        </span>
                        <a
                            href={part.url}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-primary-600 underline text-xs'
                            download={part.url.split('/').pop()}
                        >
                            下载
                        </a>
                    </div>
                )
            }
            return null
        })}
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
                        <PiArrowCounterClockwise className='text-secondary-300' size={16} />
                    </Button>
                    {Parts}
                </div>
            ) : (
                Parts
            )
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
    messages: Message[]
    isLoading?: boolean
}) => <>{messages.map((message, index) => <MemoizedMessage isLoading={isLoading} key={message.id} message={message} isLast={(index === messages.length - 1 || index === messages.length - 2) && message.role === 'user'} regenerate={regenerate} />)}</>

function ChatSession({ initialInput, shouldOpenNew, UpgradeMessage }: { initialInput?: string, shouldOpenNew?: boolean, UpgradeMessage?: ReactNode }) {
    const [storedMessages, setStoredMessages] = useAtom(messagesAtom)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const [files, setFiles] = useState<FileList | undefined>(undefined)
    const [input, setInput] = useState(initialInput ?? '')
    const { messages, status, stop, setMessages, regenerate, sendMessage } = useChat({
        transport: new DefaultChatTransport({
            api: '/api/library/chat',
        }),
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
        onError: (error) => {
            if (IS_PROD) {
                toast.error('发生错误')
            } else {
                throw error
            }
            setFiles(undefined)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    })
    const isLoading = status === 'streaming' || status === 'submitted'
    const [isFirstConversation, setIsFirstConversation] = useState(true)

    useEffect(() => {
        if (messages.length > 0) {
            setStoredMessages(messages)
        }
    }, [messages])
    useEffect(() => {
        if (shouldOpenNew) {
            startNewConversation(initialInput)
        }
    }, [shouldOpenNew])

    const startNewConversation = (initialInput?: string) => {
        stop()
        setStoredMessages([])
        setMessages([])
        setInput(isFirstConversation ? initialInput ?? '' : '')
        setIsFirstConversation(false)
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(e.target.files)
        }
    }

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return

        if (files && files.length > 0) {
            const fileParts = Promise.all(Array.from(files).map(async file => {
                const buffer = await file.arrayBuffer()
                const base64 = Buffer.from(buffer).toString('base64')
                return {
                    type: 'file' as const,
                    mediaType: file.type,
                    url: `data:${file.type};base64,${base64}`
                }
            }))

            fileParts.then(parts => {
                sendMessage({
                    role: 'user',
                    parts: [
                        { type: 'text', text: input },
                        ...parts
                    ]
                })
            })
        } else {
            sendMessage({
                role: 'user',
                parts: [{ type: 'text', text: input }]
            })
        }
        setInput('')
    }

    const handleButtonClick = () => {
        if (isLoading) {
            stop()
        } else {
            handleFormSubmit(new Event('submit') as unknown as React.FormEvent)
        }
    }

    const handlePromptClick = (prompt: string) => {
        setInput(prompt)
        // Focus the textarea after setting the input
        setTimeout(() => {
            inputRef.current?.focus()
            inputRef.current?.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length)
        }, 0)
    }

    return (
        <>
            <div className={cn(
                'flex justify-between items-center mb-4 sticky py-2 pl-5 pr-1.5 sm:pl-7 sm:pr-3 top-10 z-10 rounded-full',
                'border border-slate-300/50 dark:border-stone-600/30',
                'backdrop-blur-xl backdrop-saturate-150',
            )}>
                <H fancy className={'text-2xl sm:text-3xl italic bg-linear-to-r from-primary-800 to-primary-400 bg-clip-text text-transparent'}>
                    Talk to Your Library
                </H>
                <div className='flex items-center gap-0.5'>
                    <Button
                        radius='full'
                        color='primary'
                        variant='light'
                        startContent={<PiPlusCircle />}
                        onPress={() => startNewConversation()}
                    >
                        新建对话
                    </Button>
                </div>
            </div>
            {storedMessages.length > 0 && messages.length === 0 && <Button
                className='mb-4'
                fullWidth
                color='default'
                variant='flat'
                radius='lg'
                startContent={<PiFolderOpen />}
                onPress={() => {
                    setMessages(storedMessages)
                }}
            >
                恢复上次对话
            </Button>}
            {<Suspense>{UpgradeMessage}</Suspense>}
            {messages.length === 0 && (
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8'>
                    {initialPrompts.map((prompt, index) => (
                        <Card
                            key={index}
                            isPressable
                            onPress={() => handlePromptClick(prompt.prompt)}
                            className={cn(index === 0 && 'border border-default-300', 'bg-default-50 hover:bg-default-100/50 transition-all')}
                            shadow='none'
                        >
                            <CardBody>
                                <div className='flex items-start gap-3'>
                                    <div className='p-2 rounded-full bg-default-100'>
                                        <prompt.icon className='text-primary' size={20} />
                                    </div>
                                    <div>
                                        <h3 className='text-lg font-medium'>{prompt.title}</h3>
                                        <p className='text-sm text-secondary-500'>{prompt.prompt}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}
            <ChatMessages isLoading={isLoading} messages={messages} regenerate={regenerate} />
            <div ref={messagesEndRef} />
            <form
                onSubmit={handleFormSubmit}
                className='flex items-center gap-2 mt-auto'
            >
                <input
                    type='file'
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className='hidden'
                    accept='.pdf,.txt,.md,.jpg,.jpeg,.png'
                />
                <Input
                    ref={inputRef}
                    className='flex-1'
                    value={input}
                    variant='flat'
                    onChange={e => setInput(e.target.value)}
                    autoComplete='off'
                    startContent={<PiChatCircleDots className='text-default-500' />}
                />
                <Button
                    type='button'
                    color='primary'
                    variant='light'
                    isIconOnly
                    className='self-start'
                    startContent={
                        files && files.length > 0 ? <PiPaperclipFill size={22} /> : <PiPaperclip size={22} />
                    }
                    onPress={() => fileInputRef.current?.click()}
                ></Button>
                <Button
                    type='button'
                    color='primary'
                    isIconOnly
                    className='self-start'
                    isDisabled={status === 'ready' && !input.trim()}
                    aria-label={isLoading ? '停止' : '发送'}
                    onPress={handleButtonClick}
                    startContent={isLoading ? <PiStopCircle size={22} /> : <PiPaperPlaneRightFill size={22} />}
                ></Button>
            </form>
            <footer className='pt-4 text-sm text-secondary flex justify-center w-full'>
                <span className='flex items-center gap-2 font-mono'>
                    <PiLockSimple />
                    <span>Conversations are stored locally.</span>
                </span>
            </footer>
        </>
    )
}

export default function ChatInterface({ initialInput, shouldOpenNew }: { initialPromptIndex?: number | null, initialInput?: string, shouldOpenNew?: boolean }) {
    return (
        <Main className='flex flex-col max-w-2xl font-formal'>
            <Suspense fallback={<div className='flex justify-center items-center h-full min-h-50'><Spinner /></div>}>
                <ChatSession initialInput={initialInput} shouldOpenNew={shouldOpenNew} />
            </Suspense>
        </Main>
    )
}
