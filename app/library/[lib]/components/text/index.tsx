'use client'

import { CardBody, CardFooter } from "@heroui/card"
import { contentFontFamily } from '@/lib/fonts'
import { add, addAndGenerate } from './actions'
import { motion } from 'framer-motion'
import { PiFilePlusDuotone, PiLinkSimpleHorizontal, PiKeyboard, PiAirplaneInFlightDuotone, PiCheckSquare, PiSquare } from 'react-icons/pi'
import { useTransitionRouter } from 'next-view-transitions'
import { useTransition } from 'react'
import { useAtomValue } from 'jotai'
import { langAtom, libAtom } from '../../atoms'
import { Tabs, Tab } from '@heroui/tabs'
import { Drawer, DrawerContent, DrawerHeader, DrawerBody } from '@heroui/drawer'
import { Spinner, useDisclosure } from '@heroui/react'
import { Input } from '@heroui/input'
import { Button } from '@heroui/button'
import { getArticleFromUrl } from '@/lib/utils'
import { useState } from 'react'
import isUrl from 'is-url'
import Topics from '../../[text]/components/topics'
import Link from "next/link"
import { momentSH } from '@/lib/moment'
import { getLanguageStrategy } from '@/lib/languages'
import { toast } from 'sonner'
import FlatCard from '@/components/ui/flat-card'

function Text({ id, title, topics: textTopics, hasEbook, createdAt, disablePrefetch, disableNavigation, visitStatus }: {
    id: string,
    title: string,
    topics: string[],
    disablePrefetch?: boolean,
    disableNavigation?: boolean,
    hasEbook: boolean,
    createdAt: string,
    visitStatus?: 'loading' | 'visited' | 'not-visited',
}) {
    const lib = useAtomValue(libAtom)
    const topics = textTopics.concat(hasEbook ? ['电子书'] : [])
    const visitElement = {
        loading: <Spinner size='sm' color='default' variant='wave' />,
        'visited': <PiCheckSquare className='text-lg' />,
        'not-visited': <PiSquare className='text-lg' />
    }

    const CardInnerContent = () => (
        <>
            <CardBody className='flex flex-col gap-1 px-5 py-4'>
                <h2 className={'text-2xl text-balance'} style={{
                    fontFamily: contentFontFamily
                }}>{title}</h2>
                {topics.length > 0 && (
                    <div className='gap-0.5 flex flex-wrap align-middle items-center'>
                        <Topics topics={topics}></Topics>
                    </div>
                )}
            </CardBody>
            <CardFooter className='px-7 pb-4 pt-2 flex flex-col gap-1 items-end'>
                <div className='flex items-center w-full gap-2 text-default-500'>
                    {typeof visitStatus !== 'undefined' && (visitElement[visitStatus])}
                    <div className='flex-1' />
                    <time className='text-sm font-mono'>Created: {momentSH(createdAt).format('ll')}</time>
                </div>
            </CardFooter>
        </>
    )

    return (<div className='w-full h-full relative'>
        {disableNavigation
            ? <FlatCard background='solid' fullWidth className={'h-full'}><CardInnerContent /></FlatCard>
            // @ts-expect-error: href is a valid prop for Link
            : <FlatCard background='solid' fullWidth className={'h-full'} as={Link} href={`/library/${lib}/${id}`} isPressable prefetch={!disablePrefetch}><CardInnerContent /></FlatCard>
        }
    </div>)
}

export function AddTextButton() {
    const lib = useAtomValue(libAtom)
    const router = useTransitionRouter()
    const { isOpen, onOpen, onOpenChange } = useDisclosure()
    const [isImporting, startImporting] = useTransition()
    const [url, setUrl] = useState('')
    const [title, setTitle] = useState('')
    const lang = useAtomValue(langAtom)

    return <>
        <FlatCard className='w-full opacity-60 bg-transparent border-stone-200 dark:border-stone-600' isPressable onPress={onOpen}>
            <CardBody className='px-6 pt-5 flex items-center justify-center overflow-hidden'>
                <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                    whileHover={{ scale: 1.1, rotate: 10 }}
                    className='text-7xl h-20 text-slate-700 dark:text-slate-200 rounded-lg flex items-center justify-center'>
                    <PiFilePlusDuotone />
                </motion.div>
            </CardBody>
        </FlatCard>
        <Drawer isOpen={isOpen} onOpenChange={onOpenChange} placement='bottom' className='bg-default-50'>
            <DrawerContent>
                <DrawerHeader className='flex flex-col gap-1'>创建文章</DrawerHeader>
                <DrawerBody className='max-w-screen-sm mx-auto pb-10'>
                    <Tabs aria-label='方式'>
                        <Tab
                            key='text'
                            title={
                                <div className='flex items-center space-x-2'>
                                    <PiLinkSimpleHorizontal />
                                    <span>网址导入外刊</span>
                                </div>
                            }
                            className='flex gap-2'
                        >
                            <Input placeholder='https://www.nytimes.com/' className='w-80' variant='bordered' color='primary' value={url} onChange={(e) => setUrl(e.target.value)} />
                            <Button variant='solid' isDisabled={!isUrl(url)} startContent={!isImporting && <PiAirplaneInFlightDuotone className='text-xl' />} color='primary' isLoading={isImporting} onPress={() => {
                                startImporting(async () => {
                                    const { title, content } = await getArticleFromUrl(url)
                                    if (content.length > getLanguageStrategy(lang).maxArticleLength) {
                                        toast.error('文章内容过长或解析失败，请手动录入')
                                        return
                                    }
                                    const id = await addAndGenerate({ title, content, lib })
                                    router.push(`/library/${lib}/${id}`)
                                })
                            }}>导入</Button>
                        </Tab>
                        <Tab key='ebook'
                            title={
                                <div className='flex items-center space-x-2'>
                                    <PiKeyboard />
                                    <span>手动输入标题</span>
                                </div>
                            }
                            className='flex gap-2'>
                            <Input placeholder='标题' variant='bordered' className='w-80' color='primary' value={title} onChange={(e) => setTitle(e.target.value)} />
                            <Button variant='solid' startContent={!isImporting && <PiAirplaneInFlightDuotone className='text-xl' />} color='primary' isLoading={isImporting} onPress={() => {
                                startImporting(async () => {
                                    const id = await add({ title, lib })
                                    router.push(`/library/${lib}/${id}`)
                                })
                            }}>创建</Button>
                        </Tab>
                    </Tabs>
                </DrawerBody>
            </DrawerContent>
        </Drawer>
    </>
}

export default Text
