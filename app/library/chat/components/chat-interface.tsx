'use client'

import { UIMessage as Message, useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useAtom } from 'jotai'
import { messagesAtom } from '../atoms'
import { PiPaperPlaneRightFill, PiChatCircleDotsDuotone, PiPlusCircleDuotone, PiStopCircleDuotone, PiSparkleDuotone, PiPencilCircleDuotone, PiCopy, PiCheck, PiPackage, PiBooks, PiPaperclipFill, PiPaperclipDuotone, PiNewspaperClippingDuotone, PiNewspaperDuotone, PiLightbulb, PiEmpty, PiBookmark, PiLinkSimpleDuotone, PiLockSimpleDuotone, PiGameControllerDuotone, PiBookmarksDuotone, PiNewspaper, PiArrowCounterClockwiseDuotone, PiFolderOpenDuotone } from 'react-icons/pi'
import { memo, ReactNode, useEffect, useRef, useState } from 'react'
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
import UpgradeMessage from './upgrade-message'
import { IS_PROD } from '@/lib/env'
import H from '@/components/ui/h'
import { useCopyToClipboard } from 'usehooks-ts'
import Text from '@/app/library/[lib]/components/text'
import { ScopeProvider } from 'jotai-scope'
import { langAtom, libAtom } from '../../[lib]/atoms'
import { HydrationBoundary } from 'jotai-ssr'
import Paper from '@/components/editory'
import { toolDescriptions } from '../types'
import type { Plan } from '@/lib/config'
import moment from 'moment'
import { Image } from '@heroui/image'
import { Divider } from '@heroui/divider'
import AudioPlayer from '@/components/ui/audio-player'
import { StreakMemoryDraft } from './streak-memory-draft'

const initialPrompts = [{
    title: '造句巩固',
    prompt: '针对［近两日］学习的［英语］单词，选出几个语块，总共出五道翻译题，考察并巩固我的掌握。',
    icon: PiPencilCircleDuotone
}, {
    title: '今日词汇',
    prompt: '获取［今天］的 The Leximory Times 并提取 News 里实用于日常写作的高分语块，量少而精。',
    icon: PiBookmarksDuotone
}, {
    title: '金句提取',
    prompt: '提取［文库名称］中的［所有］文章里可借鉴于作文中的高分金句。',
    icon: PiSparkleDuotone
}, {
    title: '导入网页',
    prompt: '提取以下网页中的文章，并导入［词汇仓库］文库。',
    icon: PiLinkSimpleDuotone
}, {
    title: '注解段落',
    prompt: '注解以下段落，无需保存。',
    icon: PiNewspaperClippingDuotone
}, {
    title: '注解文章',
    prompt: '注解下文并存入［词汇仓库］文库。',
    icon: PiNewspaperDuotone
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

function ToolState({ state, toolName }: { state: string; toolName: ToolName }) {
    if (state === 'input-available') {
        return (
            <div className='flex justify-center items-center gap-2 text-sm text-default-400 font-mono mt-2'>
                <Spinner size='sm' color='default' variant='gradient' />
                <span>{toolDescriptions[toolName]}</span>
            </div>
        )
    }
    return <></>
}

function ToolAccordian({ title, children, defaultExpanded, icon, ...props }: { title: string, children: ReactNode, icon: ReactNode, defaultExpanded?: boolean } & AccordionProps) {
    return <Accordion className='mt-2 px-0' {...props} defaultExpandedKeys={defaultExpanded ? ['content'] : []}>
        <AccordionItem key='content' title={title} startContent={icon} classNames={{
            titleWrapper: 'flex-none',
            trigger: 'text-sm'
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
                <ToolAccordian title={articleTitle} icon={<PiNewspaperDuotone />}>
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
                <ToolAccordian defaultExpanded title={`Article Created`} icon={<PiNewspaperDuotone />}>
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

        case 'generateQuiz':
            const generatedQuiz = result as ToolResult['generateQuiz']
            return (
                <Card className='bg-primary-50/20 dark:bg-default-50/40' shadow='none' isBlurred>
                    <CardBody className='p-6'>
                        <Paper data={[generatedQuiz]} />
                    </CardBody>
                </Card>
            )

        case 'getTodaysTimes':
        case 'getTimesIssue':
            const { cover, audio, date, news, novel, quiz } = result as ToolResult['getTodaysTimes']
            return (
                <ToolAccordian title={`The Leximory Times — ${moment(date).tz('Asia/Shanghai').format('LL')}`} icon={<PiNewspaper />}>
                    <Card className='bg-primary-50/20 dark:bg-default-50/40' shadow='none' isBlurred>
                        <CardBody className='p-6'>
                            <div className='space-y-4'>
                                {/* Cover Image */}
                                <div className='w-full aspect-video rounded-lg flex items-center justify-center overflow-hidden'>
                                    <Image
                                        src={cover}
                                        alt='Times Cover'
                                        className='w-full h-full object-cover'
                                    />
                                </div>

                                {/* News Section */}
                                <Divider />
                                <div className='pt-4'>
                                    <h4 className='text-lg font-semibold mb-3 flex items-center gap-2'>
                                        <PiNewspaperDuotone className='text-primary' size={20} />
                                        <span>Daily News</span>
                                        {audio && <AudioPlayer src={audio} />}
                                    </h4>
                                    <div className='text-default-700 prose prose-sm max-w-none'>
                                        <Markdown md={news} />
                                    </div>
                                </div>

                                {/* Novel Section */}
                                <Divider />
                                <div className='pt-4'>
                                    <h4 className='text-lg font-semibold mb-3 flex items-center gap-2'>
                                        <PiBooks className='text-primary' size={20} />
                                        Daily Novel
                                    </h4>
                                    <div className='text-default-700 prose prose-sm max-w-none'>
                                        <Markdown md={novel} />
                                    </div>
                                </div>

                                {/* Quiz Section */}
                                {quiz && (<>
                                    <Divider />
                                    <div className='pt-4'>
                                        <h4 className='text-lg font-semibold mb-3 flex items-center gap-2'>
                                            <PiGameControllerDuotone className='text-primary' size={20} />
                                            Daily Quiz
                                        </h4>
                                        <Paper data={[quiz]} />
                                    </div>
                                </>)}
                            </div>
                        </CardBody>
                    </Card>
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
                return <pre>{JSON.stringify(part.input, null, 2)}</pre>
            case 'input-available':
                return <ToolState state={'call'} toolName={toolName} />
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
                return <div>Error: {part.errorText}</div>
        }
    }

    switch (part.type) {
        case 'text':
            return (
                <div className={cn(
                    'px-4 py-3 mt-4 rounded-2xl max-w-4/5 text-base whitespace-pre-wrap overflow-x-hidden',
                    isUser
                        ? 'bg-secondary-50/50 text-default-900 dark:bg-stone-900'
                        : 'bg-primary-50/50 text-default-900 dark:bg-neutral-900',
                )}>
                    {part.text ? <Markdown
                        md={part.text}
                        className='prose dark:prose-invert max-w-none'
                        hasWrapped={true}
                    /> : <Spinner className='w-4 h-4' />}
                </div>
            )
        case 'reasoning':
            return (
                <ToolAccordian defaultExpanded title='Reasoning' icon={<PiLightbulb size={16} />}>
                    <Markdown
                        compact
                        md={part.text || ''}
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

    const Parts = () => <>
        {parts?.map((part, j) => (
            <MemoizedMessagePart key={j} part={part as MessagePart} isUser={role === 'user'} />
        ))}
    </>

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
                        <PiArrowCounterClockwiseDuotone className='text-secondary-300' size={16} />
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
    messages: Message[]
    isLoading?: boolean
}) => <>{messages.map((message, index) => <MemoizedMessage isLoading={isLoading} key={message.id} message={message} isLast={(index === messages.length - 1 || index === messages.length - 2) && message.role === 'user'} regenerate={regenerate} />)}</>

export default function ChatInterface({ plan, initialInput, shouldOpenNew }: { plan: Plan, initialPromptIndex?: number | null, initialInput?: string, shouldOpenNew?: boolean }) {
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
        <Main className='flex flex-col max-w-2xl font-formal'>
            <div className={cn(
                'flex justify-between items-center mb-4 sticky py-2 pl-5 pr-1.5 sm:pl-7 sm:pr-3 top-10 z-10 rounded-full',
                'border border-slate-300/50 dark:border-stone-600/30',
                'backdrop-blur-xl backdrop-saturate-150',
            )}>
                <H fancy className={'text-2xl sm:text-3xl italic bg-linear-to-r from-primary-800 to-primary-300 bg-clip-text text-transparent'}>
                    Talk to Your Library
                </H>
                <div className='flex items-center gap-0.5'>
                    <Button
                        radius='full'
                        color='primary'
                        variant='light'
                        startContent={<PiPlusCircleDuotone />}
                        onPress={() => startNewConversation()}
                    >
                        新建对话
                    </Button>
                </div>
            </div>
            {storedMessages.length > 0 && messages.length === 0 && <Button
                className='mb-4'
                fullWidth
                color='primary'
                variant='flat'
                radius='lg'
                startContent={<PiFolderOpenDuotone />}
                onPress={() => {
                    setMessages(storedMessages)
                }}
            >
                恢复上次对话
            </Button>}
            {plan === 'beginner' && <UpgradeMessage />}
            {messages.length === 0 && (
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8'>
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
                    startContent={<PiChatCircleDotsDuotone className='text-default-500' />}
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
                    isDisabled={(plan === 'beginner' && IS_PROD) || (status === 'ready' && !input.trim())}
                    aria-label={isLoading ? '停止' : '发送'}
                    onPress={handleButtonClick}
                    startContent={isLoading ? <PiStopCircleDuotone size={22} /> : <PiPaperPlaneRightFill size={22} />}
                ></Button>
            </form>
            <footer className='pt-4 text-sm text-default-500 flex justify-center w-full'>
                <span className='flex items-center gap-2 font-mono'>
                    <PiLockSimpleDuotone />
                    <span>Conversations are stored locally.</span>
                </span>
            </footer>
        </Main>
    )
}
