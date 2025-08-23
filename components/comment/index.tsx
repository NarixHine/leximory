'use client'

import { Button } from "@heroui/button"
import { Spacer } from "@heroui/spacer"
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover"
import { CardBody } from "@heroui/card"
import { Textarea } from "@heroui/input"
import Markdown from 'markdown-to-jsx'
import { ComponentProps, useEffect, useState, useCallback, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { PiTrashDuotone, PiBookBookmarkDuotone, PiCheckCircleDuotone, PiArrowSquareOutDuotone, PiPencilDuotone, PiXCircleDuotone, PiEyesFill } from 'react-icons/pi'
import { cn, nanoid } from '@/lib/utils'
import { generateSingleComment } from '@/app/library/[lib]/[text]/actions'
import { readStreamableValue } from 'ai/rsc'
import { isReadOnlyAtom, langAtom, libAtom } from '@/app/library/[lib]/atoms'
import { contentAtom, textAtom } from '@/app/library/[lib]/[text]/atoms'
import { useAtomValue } from 'jotai'
import { delComment, modifyText, saveComment } from './actions'
import { motion } from 'framer-motion'
import { isReaderModeAtom } from '@/app/atoms'
import Link from 'next/link'
import { toast } from 'sonner'
import { parseCommentParams } from '@/lib/comment'
import { getLanguageStrategy } from '@/lib/languages/strategies'
import { useRouter } from 'next/navigation'
import styles from '@/styles/sidenote.module.css'
import { getClickedChunk } from './utils'
import StoneSkeleton from '../ui/stone-skeleton'
import FlatCard from '../ui/flat-card'
import { Spinner } from '@heroui/spinner'

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

    const { mutate: commentWord, isPending } = useMutation({
        mutationFn: async (prompt: string) => {
            const { text, error } = await generateSingleComment({ prompt, lang })
            if (error) {
                toast.error(error, {
                    duration: 10000,
                    action: {
                        label: '升级',
                        onClick: () => router.push('/settings')
                    }
                })
                throw new Error(error)
            }
            if (text) {
                try {
                    let commentary = ''
                    for await (const delta of readStreamableValue(text)) {
                        commentary += delta
                        setPortions(commentary.replaceAll('{', '').replaceAll('}', '').split('||'))
                        if (isOnDemand && !isLoaded) {
                            setIsLoaded(true)
                        }
                    }
                } catch {
                    toast.error('生成中止')
                }
            }
        },
        retry: 1
    })

    useEffect(() => {
        if (prompt && prompt !== '') {
            commentWord(prompt)
            setStatus('idle')
            setUid(nanoid())
            setSavedId(null)
        }
    }, [prompt])

    const wordElement = useRef<HTMLButtonElement>(null)

    const init = useCallback(() => {
        const element = wordElement.current
        if (isOnDemand && !isLoaded && element) {
            commentWord(getClickedChunk(element))
        }
    }, [isOnDemand, isLoaded, prompt])

    const editId = deleteId && deleteId !== 'undefined' ? deleteId : savedId
    const Save = () => <div className='flex gap-2'>
        {/* save button: show when user is on the library page / corpus page */}
        {!explicitDisableSave && !isDeleteable && !isEditing && status !== 'saved' && <Button
            size='sm'
            isIconOnly={!isReadOnly}
            isLoading={status === 'loading'}
            startContent={status !== 'loading' && <PiBookBookmarkDuotone size={isReadOnly ? 20 : undefined} />}
            color={'primary'}
            variant='flat'
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
                size='sm'
                isIconOnly
                isLoading={status === 'loading'}
                startContent={status !== 'loading' && (isEditing ? <PiCheckCircleDuotone /> : <PiPencilDuotone />)}
                color='primary'
                variant='flat'
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
                    size='sm'
                    color='warning'
                    variant='flat'
                    startContent={<PiXCircleDuotone />}
                    isIconOnly
                    onPress={() => {
                        setIsEditing(false)
                        setEditedPortions([])
                    }}
                ></Button>
            )}
            {editId && !isEditing && <Button
                isDisabled={status === 'deleted'}
                size='sm'
                isIconOnly
                isLoading={status === 'loading' && !isEditing}
                startContent={status !== 'loading' && <PiTrashDuotone />}
                color='danger'
                variant='flat'
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
                    return <Button as={Link} href={strategy.dictionaryLink(portions[1])} target='_blank' size='sm' startContent={<PiArrowSquareOutDuotone />} variant='flat' color='secondary' isIconOnly />
                }
                return null
            })()
        }
    </div>

    if (print) {
        return <Note portions={portions}></Note>
    }

    return asCard
        ? <FlatCard fullWidth background='solid' radius='sm' shadow='none' className={className}>
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
                                    ? <div className='flex font-mono items-center gap-1.5'>
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
                                        isOnDemand ? 'shadow-default-300/40 dark:shadow-default-400/40' : 'shadow-primary-200/40 dark:shadow-primary-600/40',
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
                <PopoverContent className={cn('max-w-80')}>
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
                isReaderMode && portions[2] && <span className={cn(styles['sidenote'], 'text-sm')}>
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
            {!isCompact && <div className='font-bold'>{lang === 'ja' ? '意味' : '释义'}</div>}
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
            {!isCompact && <div className='font-bold'>{lang === 'ja' ? '語源' : '语源'}</div>}
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
            {!isCompact && <div className='font-bold'>同源词</div>}
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
