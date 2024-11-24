/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { Button, Spacer, Skeleton, Popover, PopoverTrigger, PopoverContent, Card, CardBody, Textarea } from '@nextui-org/react'
import Markdown from 'markdown-to-jsx'
import { ComponentProps, useEffect, useState, useCallback, useRef } from 'react'
import { PiTrashDuotone, PiBookBookmarkDuotone, PiCheckCircleDuotone, PiArrowSquareOutDuotone, PiPencilDuotone, PiXCircleDuotone } from 'react-icons/pi'
import { cn, getClickedChunk, randomID } from '@/lib/utils'
import { generateSingleComment } from '@/app/library/[lib]/[text]/actions'
import { readStreamableValue } from 'ai/rsc'
import { isReadOnlyAtom, langAtom, libAtom } from '@/app/library/[lib]/atoms'
import { recentWordsAtom } from '@/app/library/[lib]/[text]/atoms'
import { useAtomValue, useSetAtom } from 'jotai'
import { delComment, saveComment } from './actions'
import { extractSaveForm } from '@/lib/lang'
import { motion } from 'framer-motion'
import { isReaderModeAtom } from '@/app/atoms'
import Link from 'next/link'
import { toast } from 'sonner'

function Comment({ params, disableSave: explicitDisableSave, deleteId, trigger, asCard, prompt }: {
    params: string,
    disableSave?: boolean
    deleteId?: string
    trigger?: ComponentProps<typeof Button>
    asCard?: boolean
    prompt?: string
}) {
    const lib = useAtomValue(libAtom)
    const isReadOnly = useAtomValue(isReadOnlyAtom)
    const isReaderMode = useAtomValue(isReaderModeAtom)
    const lang = useAtomValue(langAtom)
    const disableSave = explicitDisableSave || (deleteId && deleteId !== 'undefined') ? true : isReadOnly
    const parsedParams = JSON.parse(params.replaceAll('{', '').replaceAll('}', '').replaceAll('\n', '\\n')).map((param: string) => param.replaceAll('\\n', '\n')) as string[]
    const [portions, setPortions] = useState(parsedParams)
    const isOnDemand = parsedParams.length === 1
    const [isLoaded, setIsLoaded] = useState(!isOnDemand)
    const [status, setStatus] = useState<'' | 'saved' | 'deleted' | 'loading'>('')
    const [savedId, setSavedId] = useState<string | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [editedPortions, setEditedPortions] = useState<string[]>([])

    useEffect(() => {
        setIsLoaded(!isOnDemand)
        setStatus('')
    }, [])

    const [isVisible, setIsVisible] = useState(prompt ? true : false)

    const setRecentWords = useSetAtom(recentWordsAtom)

    const commentWord = async (prompt: string) => {
        const { text, error } = await generateSingleComment(prompt, lib)
        if (error) {
            toast.error(error)
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
            } catch (e) {
                toast.error('生成中止。')
            }
        }
    }

    useEffect(() => {
        if (prompt) {
            commentWord(prompt)
        }
    }, [prompt])

    const wordElement = useRef<HTMLButtonElement>(null)

    const init = useCallback(() => {
        const element = wordElement.current
        if (isOnDemand && !isLoaded && element) {
            commentWord(getClickedChunk(element))
        }
    }, [isOnDemand, isLoaded, prompt])

    const uid = randomID()
    const editId = deleteId && deleteId !== 'undefined' ? deleteId : savedId
    const Save = () => <div className='flex gap-2'>
        {!disableSave && !isEditing && !isReadOnly && status !== 'saved' && <Button
            size='sm'
            isIconOnly
            isLoading={status === 'loading'}
            startContent={status !== 'loading' && <PiBookBookmarkDuotone />}
            color={'primary'}
            variant='flat'
            onClick={async () => {
                // Save comment
                setStatus('loading')
                try {
                    const savedId = await saveComment(portions, lib)
                    setStatus('saved')
                    setSavedId(savedId)
                    setRecentWords((prev) => [...new Set([...prev, extractSaveForm(portions)])])
                } catch (error) {
                    setStatus('')
                    toast.error('保存失败')
                }
            }}
        ></Button>}
        {editId && !isReadOnly && <>
            <Button
                isDisabled={status === 'deleted'}
                size='sm'
                isIconOnly
                startContent={isEditing ? <PiCheckCircleDuotone /> : <PiPencilDuotone />}
                color='primary'
                variant='flat'
                onClick={() => {
                    if (isEditing) {
                        saveComment(editedPortions, lib, editId).then(() => {
                            setPortions(editedPortions)
                            setIsEditing(false)
                            toast.success('更新成功')
                        }).catch(() => {
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
                    onClick={() => {
                        setIsEditing(false)
                        setEditedPortions([])
                    }}
                ></Button>
            )}
            {editId && !isEditing && <Button
                isDisabled={status === 'deleted'}
                size='sm'
                isIconOnly
                startContent={<PiTrashDuotone />}
                color='danger'
                variant='flat'
                onClick={async () => {
                    await delComment(editId)
                    setStatus('deleted')
                }}
            ></Button>}
        </>}
        {lang === 'en' && <Button as={Link} href={`https://www.etymonline.com/word/${portions[1]}`} target='_blank' size='sm' startContent={<PiArrowSquareOutDuotone />} variant='flat' color='secondary' isIconOnly></Button>}
    </div>

    return asCard
        ? <Card shadow='sm' fullWidth radius='sm'>
            <CardBody className='p-6 py-4 leading-snug'>
                <div className={'font-bold text-lg'}>{portions[1]}</div>
                <div className='relative'>
                    {!isVisible && (
                        <Button
                            variant='flat'
                            color='secondary'
                            className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10'
                            onClick={() => setIsVisible(!isVisible)}
                        >
                            显示词义
                        </Button>
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
                </div>
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
                                    isOnDemand ? 'decoration-primary/60' : 'decoration-danger'
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
                <PopoverContent className='max-w-80'>
                    <div className='py-3 px-2 space-y-5'>
                        {
                            isLoaded
                                ? <div>
                                    <Note portions={portions} isEditing={isEditing} editedPortions={editedPortions} onEdit={setEditedPortions}></Note>
                                    {(!disableSave || (deleteId && deleteId !== 'undefined') || lang === 'en') && <Spacer y={4}></Spacer>}
                                    <Save />
                                </div>
                                : <div className='space-y-3 w-40'>
                                    <Skeleton className='w-3/5 rounded-lg h-3'></Skeleton>
                                    <Skeleton className='w-4/5 rounded-lg h-3'></Skeleton>
                                    <Skeleton className='w-2/5 rounded-lg h-3'></Skeleton>
                                    <Skeleton className='w-full rounded-lg h-3'></Skeleton>
                                </div>
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

function Note({ portions, isCompact, omitOriginal, isEditing, editedPortions, onEdit }: {
    portions: string[]
    isCompact?: boolean
    omitOriginal?: boolean
    isEditing?: boolean
    editedPortions?: string[]
    onEdit?: (portions: string[]) => void
}) {
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
                    onChange={(e) => handleEdit(1, e.target.value)}
                    className='mb-2'
                    placeholder='词条'
                />
                : <div className={isCompact ? 'font-bold text-[0.8rem]' : 'font-extrabold text-large'}>{portions[1]}</div>
        )}
        {portions[2] && <div className={margin}>
            {!isCompact && <div className='font-bold'>释义</div>}
            {isEditing
                ? <Textarea
                    size='sm'
                    value={editedPortions?.[2] || ''}
                    onChange={(e) => handleEdit(2, e.target.value)}
                    placeholder='释义'
                />
                : <Markdown className='before:prose-code:content-["["] after:prose-code:content-["]"]'>{portions[2]}</Markdown>
            }
        </div>}
        {portions[3] && <div className={margin}>
            {!isCompact && <div className='font-bold'>语源</div>}
            {isEditing
                ? <Textarea
                    size='sm'
                    value={editedPortions?.[3] || ''}
                    onChange={(e) => handleEdit(3, e.target.value)}
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
                    onChange={(e) => handleEdit(4, e.target.value)}
                    placeholder='同源词'
                />
                : <Markdown>{portions[4]}</Markdown>
            }
        </div>}
    </div>)
}

export default Comment
