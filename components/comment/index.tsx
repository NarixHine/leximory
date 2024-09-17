'use client'

import { Button, Divider, Skeleton, Popover, PopoverTrigger, PopoverContent, Card, CardBody } from '@nextui-org/react'
import Markdown from 'markdown-to-jsx'
import { ComponentProps, useEffect, useState } from 'react'
import { PiTrashDuotone, PiBookBookmarkDuotone, PiCheckCircleDuotone } from 'react-icons/pi'
import { cn, randomID } from '@/lib/utils'
import { generateSingleComment } from '@/app/library/[lib]/[text]/actions'
import { readStreamableValue } from 'ai/rsc'
import { toast } from 'sonner'
import { isReadOnlyAtom, libAtom } from '@/app/library/[lib]/atoms'
import { useAtomValue } from 'jotai'
import { delComment, loadMeanings, saveComment } from './actions'
import { motion } from 'framer-motion'
import { isReaderModeAtom } from '@/app/atoms'

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
    const [status, setStatus] = useState('')

    useEffect(() => {
        setWords([parsedParams])
        setIsLoaded(!isOnDemand)
        setStatus('')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const commentWord = async () => {
            const { text, error } = await generateSingleComment(prompt as string, lib)
            if (error) {
                toast.error(error)
            }
            else if (text) {
                try {
                    let commentary = ''
                    for await (const delta of readStreamableValue(text)) {
                        commentary += delta
                        setWords([commentary.replaceAll('{', '').replaceAll('}', '').split('||')])
                    }
                } catch (e) {
                    toast.error('生成中止。')
                }
            }
        }
        if (prompt)
            commentWord()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prompt])


    const [isVisible, setIsVisible] = useState(prompt ? true : false)
    const init = async () => {
        if (isOnDemand && !isLoaded) {
            const defs = await loadMeanings(words[0][0])
            if (defs.length === 0) {
                setWords(words => [[words[0][0], words[0][0], '未找到释义。']])
            }
            else {
                setWords(words => defs.map((word) => [
                    words[0][0],
                    word.word,
                    word.translation?.replaceAll('\\n', '\n\n')
                ]))
            }
            setIsLoaded(true)
        }
    }

    const uid = randomID()
    const Save = !disableSave && <>
        <Divider className='my-2'></Divider>
        <Button
            size='sm'
            isDisabled={status === 'saved'}
            isLoading={status === 'loading'}
            startContent={status === 'saved'
                ? <PiCheckCircleDuotone />
                : (status !== 'loading' && <PiBookBookmarkDuotone />)}
            color='primary'
            variant='flat'
            onClick={async () => {
                setStatus('loading')
                saveComment(words[0], lib)
                    .then(() => {
                        setStatus('saved')
                    })
                    .catch(() => {
                        setStatus('')
                    })
            }}
        >保存至语料本</Button>
    </>

    return asCard
        ? <Card shadow='sm' fullWidth radius='sm'>
            <CardBody className='p-6 pt-4 pb-3 leading-snug'>
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
                        className='overflow-hidden'
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
                                    status === 'deleted' && 'line-through',
                                    !isReaderMode && 'underline decoration-wavy underline-offset-[3px]',
                                    isOnDemand ? 'decoration-primary/60' : 'decoration-danger'
                                )}
                                style={{ fontStyle: 'inherit' }}
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
                                    {index === 0 ? Save : <></>}
                                    {deleteId && deleteId !== 'undefined' && <>
                                        <Divider className='my-2'></Divider>
                                        <Button
                                            isDisabled={status === 'deleted'}
                                            size='sm'
                                            startContent={<PiTrashDuotone />}
                                            color='danger'
                                            variant='flat'
                                            onClick={async () => {
                                                await delComment(deleteId, lib)
                                                setStatus('deleted')
                                            }}
                                        >从语料本删除</Button>
                                    </>}
                                </div>)
                                : <div className='space-y-3 w-40'>
                                    <Skeleton className='w-3/5 rounded-lg'>
                                        <div className='h-3 w-3/5 rounded-lg bg-default-200 mb-2'></div>
                                    </Skeleton>
                                    <Skeleton className='w-2/5 rounded-lg'>
                                        <div className='h-3 w-4/5 rounded-lg bg-default-200'></div>
                                    </Skeleton>
                                    <Skeleton className='w-full rounded-lg'>
                                        <div className='h-3 w-2/5 rounded-lg bg-default-300'></div>
                                    </Skeleton>
                                    <Skeleton className='w-full rounded-lg'>
                                        <div className='h-3 w-2/5 rounded-lg bg-default-300'></div>
                                    </Skeleton>
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
                <Markdown>{isCompact ? portions[2].replaceAll('\n\n', '; ') : portions[2]}</Markdown>
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
