'use client'

import { Button } from "@heroui/button"
import { Spacer } from "@heroui/spacer"
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover"
import { CardBody } from "@heroui/card"
import { Textarea } from "@heroui/input"
import Markdown from 'markdown-to-jsx'
import { ComponentProps, useEffect, useState, useCallback, useRef } from 'react'
import { useQuery, queryOptions, experimental_streamedQuery as streamedQuery } from '@tanstack/react-query'
import { PiTrash, PiBookBookmark, PiCheckCircle, PiArrowSquareOut, PiPencil, PiXCircle, PiEyesFill, PiEyeSlash } from 'react-icons/pi'
import { cn, nanoid } from '@/lib/utils'
import { generateSingleComment } from '@/app/library/[lib]/[text]/actions'
import { isReadOnlyAtom, langAtom, libAtom } from '@/app/library/[lib]/atoms'
import { contentAtom, textAtom } from '@/app/library/[lib]/[text]/atoms'
import { useAtomValue } from 'jotai'
import { delComment, modifyText, saveComment } from './actions'
import { motion } from 'framer-motion'
import { isReaderModeAtom } from '@/app/atoms'
import { toast } from 'sonner'
import { parseCommentParams } from '@/lib/comment'
import { getLanguageStrategy } from '@/lib/languages/strategies'
import { Lang } from '@repo/env/config'
import { useRouter } from 'next/navigation'
import styles from '@/styles/sidenote.module.css'
import { getClickedChunk } from './utils'
import { readStreamableValue } from '@repo/ui/utils'
import StoneSkeleton from '../ui/stone-skeleton'
import FlatCard from '../ui/flat-card'
import { Spinner } from '@heroui/spinner'
import LinkButton from '../ui/link-button'

interface CommentProps {
    params: string
    disableSave?: boolean
    deleteId?: string
    trigger?: ComponentProps<typeof Button>
    asCard?: boolean
    prompt?: string
    onlyComments?: boolean
    print?: boolean
    shadow?: boolean
    className?: string
}

interface CommentState {
    status: 'idle' | 'loading' | 'saved' | 'deleted'
    error?: string
    savedId: string | null
}

async function* commentWordStream({
    prompt,
    lang,
    onError,
}: {
    prompt: string
    lang: Lang
    onError: (error: string) => void
}) {
    const { text, error } = await generateSingleComment({ prompt, lang })
    if (error) {
        onError(error)
        throw new Error(error)
    }
    if (text) {
        try {
            let commentary = ''
            for await (const delta of readStreamableValue(text)) {
                commentary += delta
                yield commentary.replaceAll('{', '').replaceAll('}', '').split('||')
            }
        } catch (err) {
            console.error(err)
            toast.error('生成中止')
        }
    }
}

const commentQueryOptions = (prompt: string, lang: Lang, onError: (error: string) => void) =>
    queryOptions({
        queryKey: ['comment-word', prompt, lang],
        queryFn: streamedQuery({
            streamFn: () => commentWordStream({ prompt, lang, onError }),
        }),
        staleTime: Infinity,
        enabled: prompt.length > 0,
    })

function Comment({ params, disableSave: explicitDisableSave, deleteId, trigger, asCard, prompt, onlyComments, print, className }: CommentProps) {
    const router = useRouter()
    const lib = useAtomValue(libAtom)
    const content = useAtomValue(contentAtom)
    const text = useAtomValue(textAtom)
    const isReadOnly = useAtomValue(isReadOnlyAtom)
    const isReaderMode = useAtomValue(isReaderModeAtom)
    const isDeleteable = deleteId && deleteId !== 'undefined'
    const lang = useAtomValue(langAtom)
    const parsedParams = parseCommentParams(params)
    const [portions, setPortions] = useState(parsedParams)
    const isOnDemand = parsedParams.length === 1
    const [isLoaded, setIsLoaded] = useState(!isOnDemand)
    const [status, setStatus] = useState<CommentState['status']>('idle')
    const [savedId, setSavedId] = useState<CommentState['savedId']>(null)
    const [uid, setUid] = useState<string>(nanoid())
    const [isEditing, setIsEditing] = useState(false)
    const [editedPortions, setEditedPortions] = useState<string[]>([])

    useEffect(() => {
        setIsLoaded(!isOnDemand)
        setStatus('idle')
    }, [isOnDemand])

    useEffect(() => {
        setPortions(parsedParams)
    }, [params])

    const [isVisible, setIsVisible] = useState(prompt ? true : onlyComments)

    const [activePrompt, setActivePrompt] = useState(prompt ?? '')

    const { data: streamData = [], isPending } = useQuery(
        commentQueryOptions(
            activePrompt,
            lang,
            (error) => toast.error(error, {
                duration: 10000,
                action: {
                    label: '升级',
                    onClick: () => router.push('/settings'),
                },
            })
        )
    )

    useEffect(() => {
        if (streamData.length > 0) {
            const latest = streamData[streamData.length - 1]
            setPortions(latest)
            if (isOnDemand && !isLoaded) {
                setIsLoaded(true)
            }
        }
    }, [streamData])

    useEffect(() => {
        if (prompt && prompt !== '') {
            setActivePrompt(prompt)
            setStatus('idle')
            setUid(nanoid())
            setSavedId(null)
        }
    }, [prompt])

    const wordElement = useRef<HTMLButtonElement>(null)

    const init = useCallback(() => {
        const element = wordElement.current
        if (isOnDemand && !isLoaded && element) {
            setActivePrompt(getClickedChunk(element))
        }
    }, [isOnDemand, isLoaded, prompt])

    const editId = deleteId && deleteId !== 'undefined' ? deleteId : savedId
    const Save = () => <div className='flex gap-1'>
        {/* save button: show when user is on the library page / corpus page */}
        {!explicitDisableSave && !isDeleteable && !isEditing && status !== 'saved' && <Button
            isIconOnly={!isReadOnly}
            isLoading={status === 'loading'}
            startContent={status !== 'loading' && <PiBookBookmark className='size-5' />}
            color={'primary'}
            variant='solid'
            className='rounded-4xl'
            onPress={async () => {
                setStatus('loading')
                try {
                    const savedId = await saveComment({ portions, lib, shadow: isReadOnly, lang })
                    setStatus('saved')
                    setSavedId(savedId)
                } catch {
                    setStatus('idle')
                    toast.error('保存失败')
                }
            }}
        >{isReadOnly ? '存入个人文库' : null}</Button>}
        {editId && !explicitDisableSave && !prompt && <>
            <Button
                isDisabled={status === 'deleted'}
                isIconOnly
                className='rounded-4xl'
                isLoading={status === 'loading'}
                startContent={status !== 'loading' && (isEditing ? <PiCheckCircle className='size-5' /> : <PiPencil className='size-5' />)}
                color='secondary'
                variant={isEditing ? 'solid' : 'light'}
                onPress={() => {
                    if (isEditing) {
                        setStatus('loading')
                        saveComment({ portions: editedPortions, lib, editId, shadow: isReadOnly, lang }).then(async () => {
                            if (content && text && !isReadOnly) {
                                await modifyText(text, content.replaceAll(`{{${portions.filter(Boolean).join('||')}}}`, `{{${editedPortions.filter(Boolean).join('||')}}}`))
                            }
                            setPortions(editedPortions)
                            setIsEditing(false)
                            setStatus('saved')
                            toast.success('更新成功')
                        }).catch(() => {
                            setStatus('saved')
                            toast.error('保存失败')
                        })
                    } else {
                        setEditedPortions([...portions])
                        setIsVisible(true)
                        setIsEditing(true)
                    }
                }}
            ></Button>
            {isEditing && (
                <Button
                    color='secondary'
                    variant='light'
                    className='rounded-4xl'
                    startContent={<PiXCircle className='size-5' />}
                    isIconOnly
                    onPress={() => {
                        setIsEditing(false)
                        setEditedPortions([])
                    }}
                ></Button>
            )}
            {editId && !isEditing && <Button
                isDisabled={status === 'deleted'}
                isIconOnly
                isLoading={status === 'loading' && !isEditing}
                startContent={status !== 'loading' && <PiTrash className='size-5' />}
                color='secondary'
                className='rounded-4xl'
                variant='light'
                onPress={async () => {
                    setStatus('loading')
                    try {
                        await delComment(editId)
                        setStatus('deleted')
                    } catch {
                        setStatus('idle')
                        toast.error('删除失败')
                    }
                }}
            ></Button>}
        </>}
        {
            (() => {
                const strategy = getLanguageStrategy(lang)
                if (strategy.dictionaryLink) {
                    return <LinkButton
                        href={strategy.dictionaryLink(portions[1])}
                        target='_blank'
                        startContent={<PiArrowSquareOut className='size-5' />}
                        className='rounded-4xl'
                        variant='light'
                        color='secondary'
                        isIconOnly />
                }
                return null
            })()
        }
    </div>

    if (print) {
        return <Note portions={portions}></Note>
    }

    return asCard
        ? <FlatCard fullWidth background='solid' shadow='none' className={cn('rounded-4xl px-4 pt-3', className)}>
            <CardBody className={cn('px-3 pb-2.5 pt-1.5 leading-snug', lang === 'ja' ? 'font-ja' : 'font-formal')}>
                <div className={'font-bold text-lg'}>{portions[1] ?? portions[0]}</div>
                <div className='relative'>
                    {!isVisible && (
                        <div className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 pb-7'>
                            <Button
                                variant='ghost'
                                isIconOnly
                                startContent={<PiEyesFill />}
                                color='secondary'
                                radius='full'
                                onPress={() => setIsVisible(!isVisible)}
                            />
                        </div>
                    )}
                    <motion.div
                        transition={{ duration: 0.5 }}
                        className='overflow-hidden'
                    >
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: isVisible ? 1 : 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            {
                                isPending && portions.length === 0
                                    ? <div className='flex font-mono items-center gap-1.5 px-2'>
                                        Generating <Spinner variant='dots' color='default' />
                                    </div>
                                    : <Note
                                        omitOriginal
                                        portions={portions}
                                        isEditing={isEditing}
                                        editedPortions={editedPortions}
                                        onEdit={setEditedPortions}
                                    />
                            }
                        </motion.div>
                        {portions[2] && <><Spacer y={3} /><Save /></>}
                    </motion.div>
                </div>
            </CardBody>
        </FlatCard>
        : <>
            <Popover placement='right' onOpenChange={init}>
                <PopoverTrigger>
                    {
                        trigger
                            ? <Button {...trigger}></Button>
                            : <button
                                className={cn(
                                    status === 'deleted' && 'opacity-30',
                                    'text-inherit'
                                )}
                                style={{ fontStyle: 'inherit' }}
                                ref={wordElement}
                            >
                                <span className={cn(
                                    !isReaderMode && [
                                        'box-decoration-clone',
                                        '[box-shadow:inset_0_-0.5em_0_0_var(--tw-shadow-color)]',
                                        isOnDemand ? 'shadow-emerald-300/30' : 'shadow-default-300/70',
                                    ]
                                )}>
                                    {portions[0]}
                                </span>
                                {isReaderMode && portions[2] && <>
                                    <label htmlFor={uid} className={styles['sidenote-number']}></label>
                                    <input type='checkbox' id={uid} className={styles['margin-toggle']} />
                                </>}
                            </button>
                    }
                </PopoverTrigger>
                <PopoverContent className={cn('max-w-80 bg-default-50 shadow-none border-7 border-default-200 rounded-4xl')}>
                    <div className='py-3 px-2 space-y-5'>
                        {
                            isLoaded
                                ? <div>
                                    <Note portions={portions} isEditing={isEditing} editedPortions={editedPortions} onEdit={setEditedPortions}></Note>
                                    {(!explicitDisableSave || isDeleteable || lang === 'en') && <Spacer y={4}></Spacer>}
                                    <Save />
                                </div>
                                : <div className='space-y-3 w-40'>
                                    <StoneSkeleton className='w-3/5 rounded-lg h-3'></StoneSkeleton>
                                    <StoneSkeleton className='w-4/5 rounded-lg h-3'></StoneSkeleton>
                                    <StoneSkeleton className='w-2/5 rounded-lg h-3'></StoneSkeleton>
                                    <StoneSkeleton className='w-full rounded-lg h-3'></StoneSkeleton>
                                </div>
                        }
                    </div>
                </PopoverContent>
            </Popover>
            {
                isReaderMode && portions[2] && <span className={cn(styles['sidenote'], 'text-sm group')}>
                    <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="default"
                        onPress={() => setPortions([portions[0]])}
                        className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                        <PiEyeSlash />
                    </Button>
                    <Note portions={portions} isEditing={isEditing} editedPortions={editedPortions} onEdit={setEditedPortions}></Note>
                </span>
            }
        </>
}

function Note({ portions, omitOriginal, isEditing, editedPortions, onEdit }: {
    portions: string[]
    omitOriginal?: boolean
    isEditing?: boolean
    editedPortions?: string[]
    onEdit?: (portions: string[]) => void
}) {
    const lang = useAtomValue(langAtom)
    const isCompact = useAtomValue(isReaderModeAtom)
    const margin = isCompact ? 'mt-1' : 'my-2'

    const handleEdit = (index: number, value: string) => {
        if (onEdit && editedPortions) {
            const newPortions = [...editedPortions]
            newPortions[index] = value
            onEdit(newPortions)
        }
    }

    return (<div className={cn(isCompact ? 'leading-tight' : '', lang === 'ja' ? 'font-ja' : 'font-formal')}>
        {!omitOriginal && (
            isEditing
                ? <Textarea
                    size='sm'
                    value={editedPortions?.[1] || ''}
                    onValueChange={(value) => handleEdit(1, value)}
                    className='mb-2'
                    placeholder='词条'
                />
                : <div className={isCompact ? 'font-bold text-medium' : 'font-extrabold text-large'}>{portions[1]}</div>
        )}
        {portions[2] && <div className={margin}>
            {!isCompact && <div className='text-default-400'>{lang === 'ja' ? '意味' : '释义'}</div>}
            {isEditing
                ? <Textarea
                    size='sm'
                    value={editedPortions?.[2] || ''}
                    onValueChange={(value) => handleEdit(2, value)}
                    placeholder='释义'
                />
                : <Markdown className='prose-em:font-light prose-code:before:content-["["] prose-code:after:content-["]"] prose-code:font-medium'>{portions[2]}</Markdown>
            }
        </div>}
        {portions[3] && <div className={margin}>
            {!isCompact && <div className='text-default-400'>{lang === 'ja' ? '語源' : '语源'}</div>}
            {
                isEditing
                    ? <Textarea
                        size='sm'
                        value={editedPortions?.[3] || ''}
                        onValueChange={(value) => handleEdit(3, value)}
                        placeholder='语源'
                    />
                    : <Markdown>{portions[3]}</Markdown>
            }
        </div>}
        {portions[4] && <div className={margin}>
            {!isCompact && <div className='text-default-400'>同源词</div>}
            {isEditing
                ? <Textarea
                    size='sm'
                    value={editedPortions?.[4] || ''}
                    onValueChange={(value) => handleEdit(4, value)}
                    placeholder='同源词'
                />
                : <Markdown>{portions[4]}</Markdown>
            }
        </div>}
    </div>)
}

export default Comment
