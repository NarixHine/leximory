/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { Button, Spacer, Skeleton, Popover, PopoverTrigger, PopoverContent, Card, CardBody } from '@nextui-org/react'
import Markdown from 'markdown-to-jsx'
import { ComponentProps, useEffect, useState, useCallback, useRef } from 'react'
import { PiTrashDuotone, PiBookBookmarkDuotone, PiCheckCircleDuotone, PiArrowSquareOutDuotone, PiArrowCounterClockwiseDuotone } from 'react-icons/pi'
import { cn, getClickedChunk, randomID } from '@/lib/utils'
import { generateSingleComment } from '@/app/library/[lib]/[text]/actions'
import { readStreamableValue } from 'ai/rsc'
import { isReadOnlyAtom, langAtom, libAtom } from '@/app/library/[lib]/atoms'
import { useAtomValue } from 'jotai'
import { delComment, saveComment } from './actions'
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
    const disableSave = explicitDisableSave || (deleteId && deleteId !== 'undefined') ? true : isReadOnly

    const parsedParams = JSON.parse(params.replaceAll('{', '').replaceAll('}', '').replaceAll('\n', '\\n')).map((param: string) => param.replaceAll('\\n', '\n'))
    const [words, setWords] = useState([parsedParams])
    const isOnDemand = parsedParams.length === 1
    const [isLoaded, setIsLoaded] = useState(!isOnDemand)
    const [status, setStatus] = useState<'' | 'saved' | 'deleted' | 'loading'>('')
    const [savedId, setSavedId] = useState<string | null>(null)

    useEffect(() => {
        setWords([parsedParams])
        setIsLoaded(!isOnDemand)
        setStatus('')
    }, [])

    const [isVisible, setIsVisible] = useState(prompt ? true : false)


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
                    setWords([commentary.replaceAll('{', '').replaceAll('}', '').split('||')])
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

    const lang = useAtomValue(langAtom)
    const uid = randomID()
    const Save = !disableSave && <>
        <Button
            size='sm'
            isDisabled={status === 'saved' && !savedId}
            isLoading={status === 'loading'}
            startContent={status === 'saved'
                ? (savedId ? <PiArrowCounterClockwiseDuotone /> : <PiCheckCircleDuotone />)
                : (status !== 'loading' && <PiBookBookmarkDuotone />)}
            color={status === 'saved' && savedId ? 'secondary' : 'primary'}
            variant='flat'
            onClick={async () => {
                if (status === 'saved' && savedId) {
                    // Undo save
                    setStatus('loading')
                    try {
                        await delComment(savedId)
                        setStatus('')
                        setSavedId(null)
                    } catch (error) {
                        setStatus('saved')
                    }
                } else {
                    // Save comment
                    setStatus('loading')
                    try {
                        const savedId = await saveComment(words[0], lib)
                        setStatus('saved')
                        setSavedId(savedId)
                    } catch (error) {
                        setStatus('')
                    }
                }
            }}
        >
            {savedId ? '撤销' : '保存至语料本'}
        </Button>
    </>

    return asCard
        ? <Card shadow='sm' fullWidth radius='sm'>
            <CardBody className='p-6 py-4 leading-snug'>
                <div className={'font-bold text-lg'}>{words[0][1]}</div>
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
                            <Note omitOriginal portions={words[0]}></Note>
                        </motion.div>
                    </motion.div>
                    {words[0][2] && prompt && Save}
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
                                {words[0][0]}
                                {isReaderMode && words[0][2] && <>
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
                                ? words.map((portions, index) => <div key={portions[1]}>
                                    <Note portions={portions}></Note>
                                    <Spacer y={4}></Spacer>
                                    <div className='flex gap-2'>
                                        {index === 0 ? Save : <></>}
                                        {deleteId && deleteId !== 'undefined' && <>
                                            <Button
                                                isDisabled={status === 'deleted'}
                                                size='sm'
                                                startContent={<PiTrashDuotone />}
                                                color='danger'
                                                variant='flat'
                                                onClick={async () => {
                                                    await delComment(deleteId)
                                                    setStatus('deleted')
                                                }}
                                            >从语料本删除</Button>
                                        </>}
                                        {lang === 'en' && <Button as={Link} href={`https://www.etymonline.com/word/${words[0][1]}`} target='_blank' size='sm' startContent={<PiArrowSquareOutDuotone />} variant='flat' color='secondary' isIconOnly></Button>}
                                    </div>
                                </div>)
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
                isReaderMode && words[0][2] && <span className='sidenote text-sm'>
                    <Note portions={words[0]} isCompact></Note>
                </span>
            }
        </>
}

function Note({ portions, isCompact, omitOriginal }: {
    portions: string[]
    isCompact?: boolean
    omitOriginal?: boolean
}) {
    const margin = isCompact ? 'mt-1' : 'my-2'
    return (<div className={isCompact ? 'leading-tight' : ''}>
        {
            !omitOriginal && <div className={isCompact ? 'font-bold text-[0.8rem]' : 'font-extrabold text-large'}>{portions[1]}</div>
        }
        {
            portions[2] && <div className={margin}>
                {!isCompact && <div className='font-bold'>释义</div>}
                <Markdown className='before:prose-code:content-["["] after:prose-code:content-["]"]'>{portions[2]}</Markdown>
            </div>
        }
        {
            portions[3] && <div className={margin}>
                {!isCompact && <div className='font-bold'>语源</div>}
                <Markdown>{portions[3]}</Markdown>
            </div>
        }
        {
            portions[4] && <div className={margin}>
                {!isCompact && <div className='font-bold'>同源词</div>}
                <Markdown>{portions[4]}</Markdown>
            </div>
        }
    </div>)
}

export default Comment
