'use client'

import { Button } from "@heroui/button"
import { Spacer } from "@heroui/spacer"
import { Skeleton } from "@heroui/skeleton"
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover"
import { Card, CardBody } from "@heroui/card"
import { Textarea } from "@heroui/input"
import Markdown from 'markdown-to-jsx'
import { ComponentProps, useEffect, useState, useCallback, useRef } from 'react'
import { PiTrashDuotone, PiBookBookmarkDuotone, PiCheckCircleDuotone, PiArrowSquareOutDuotone, PiPencilDuotone, PiXCircleDuotone, PiSignInDuotone, PiEyesFill } from 'react-icons/pi'
import { cn, getClickedChunk, randomID } from '@/lib/utils'
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
import { useAuth } from '@clerk/nextjs'
import { useLogSnag } from '@logsnag/next'
import { bilibiliLink } from '@/lib/config'
import { parseCommentParams } from '@/lib/lang'

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
}

interface CommentState {
    status: 'idle' | 'loading' | 'saved' | 'deleted'
    error?: string
    savedId: string | null
}

function Comment({ params, disableSave: explicitDisableSave, deleteId, trigger, asCard, prompt, onlyComments, print, shadow }: CommentProps) {
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
    const [uid, setUid] = useState<string>(randomID())
    const [isEditing, setIsEditing] = useState(false)
    const [editedPortions, setEditedPortions] = useState<string[]>([])

    useEffect(() => {
        setIsLoaded(!isOnDemand)
        setStatus('idle')
    }, [])

    const [isVisible, setIsVisible] = useState(prompt ? true : onlyComments)

    const commentWord = async (prompt: string) => {
        const { text, error } = await generateSingleComment(prompt, lib)
        if (error) {
            toast.error(error, {
                duration: 10000,
                action: {
                    label: '联系我们',
                    onClick: () => window.open(bilibiliLink, '_blank')
                }
            })
        }
        else if (text) {
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
                toast.error('生成中止。')
            }
        }
    }

    useEffect(() => {
        if (prompt) {
            commentWord(prompt)
            setStatus('idle')
            setUid(randomID())
            setSavedId(null)
        }
    }, [prompt])

    const wordElement = useRef<HTMLButtonElement>(null)

    const { userId } = useAuth()
    const init = useCallback(() => {
        const element = wordElement.current
        if (isOnDemand && !isLoaded && element && userId) {
            commentWord(getClickedChunk(element))
        }
    }, [isOnDemand, isLoaded, prompt])

    const editId = deleteId && deleteId !== 'undefined' ? deleteId : savedId
    const { track } = useLogSnag()
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
                track({
                    event: '词汇保存',
                    channel: 'corpus',
                    description: `保存了 ${portions[1]}`,
                    icon: '💾',
                    tags: { lib }
                })
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
        {(lang === 'en' || lang === 'zh') && <Button as={Link} href={lang === 'en' ? `https://www.etymonline.com/word/${portions[1]}` : `https://www.zdic.net/hans/${portions[1]}`} target='_blank' size='sm' startContent={<PiArrowSquareOutDuotone />} variant='flat' color='secondary' isIconOnly></Button>}
    </div>

    if (print) {
        return <Note portions={portions}></Note>
    }

    return asCard
        ? <Card shadow={shadow ? 'sm' : 'none'} fullWidth radius='sm'>
            <CardBody className='p-6 py-4 leading-snug'>
                <div className={'font-bold text-lg'}>{portions[1] ?? portions[0]}</div>
                {portions.length > 1 && <div className='relative'>
                    {!isVisible && (
                        <Button
                            variant='ghost'
                            isIconOnly
                            startContent={<PiEyesFill />}
                            color='secondary'
                            className='absolute rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10'
                            onPress={() => setIsVisible(!isVisible)}
                        ></Button>
                    )}
                    <motion.div
                        transition={{ duration: 0.5 }}
                        style={{
                            overflow: 'hidden'
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: isVisible ? 1 : 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <Note omitOriginal portions={portions} isEditing={isEditing} editedPortions={editedPortions} onEdit={setEditedPortions}></Note>
                        </motion.div>
                    </motion.div>
                    {portions[2] && prompt && <Save />}
                </div>}
            </CardBody>
        </Card>
        : <>
            <Popover placement='right' onOpenChange={init}>
                <PopoverTrigger>
                    {
                        trigger
                            ? <Button {...trigger}></Button>
                            : <button
                                className={cn(
                                    status === 'deleted' && 'opacity-30',
                                    !isReaderMode && 'underline decoration-wavy underline-offset-[3px]',
                                    isOnDemand ? 'decoration-default-300' : 'decoration-default-500'
                                )}
                                style={{ fontStyle: 'inherit' }}
                                ref={wordElement}
                            >
                                {portions[0]}
                                {isReaderMode && portions[2] && <>
                                    <label htmlFor={uid} className='margin-toggle sidenote-number'></label>
                                    <input type='checkbox' id={uid} className='margin-toggle' />
                                </>}
                            </button>
                    }
                </PopoverTrigger>
                <PopoverContent className={cn('max-w-80', !userId && !isLoaded && 'bg-background/50')}>
                    <div className='py-3 px-2 space-y-5'>
                        {
                            isLoaded
                                ? <div>
                                    <Note portions={portions} isEditing={isEditing} editedPortions={editedPortions} onEdit={setEditedPortions}></Note>
                                    {(!explicitDisableSave || !isDeleteable || lang === 'en') && <Spacer y={4}></Spacer>}
                                    <Save />
                                </div>
                                : userId ? <div className='space-y-3 w-40'>
                                    <Skeleton className='w-3/5 rounded-lg h-3'></Skeleton>
                                    <Skeleton className='w-4/5 rounded-lg h-3'></Skeleton>
                                    <Skeleton className='w-2/5 rounded-lg h-3'></Skeleton>
                                    <Skeleton className='w-full rounded-lg h-3'></Skeleton>
                                </div>
                                    : <Button startContent={<PiSignInDuotone />} as={Link} href='/sign-in' color='secondary' variant='shadow'>登录</Button>
                        }
                    </div>
                </PopoverContent>
            </Popover>
            {
                isReaderMode && portions[2] && <span className='sidenote text-sm'>
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
    const isCompact = useAtomValue(isReaderModeAtom)
    const margin = isCompact ? 'mt-1' : 'my-2'

    const handleEdit = (index: number, value: string) => {
        if (onEdit && editedPortions) {
            const newPortions = [...editedPortions]
            newPortions[index] = value
            onEdit(newPortions)
        }
    }

    return (<div className={isCompact ? 'leading-tight' : ''}>
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
            {!isCompact && <div className='font-bold'>释义</div>}
            {isEditing
                ? <Textarea
                    size='sm'
                    value={editedPortions?.[2] || ''}
                    onValueChange={(value) => handleEdit(2, value)}
                    placeholder='释义'
                />
                : <Markdown className='prose-em:font-light before:prose-code:content-["["] after:prose-code:content-["]"]'>{portions[2]}</Markdown>
            }
        </div>}
        {portions[3] && <div className={margin}>
            {!isCompact && <div className='font-bold'>语源</div>}
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
