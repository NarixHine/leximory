'use client'

import { Card, CardBody, CardFooter } from "@heroui/card"
import { postFontFamily } from '@/lib/fonts'
import { add, addAndGenerate } from './actions'
import { motion } from 'framer-motion'
import { PiFilePlusDuotone, PiLinkSimpleHorizontal, PiKeyboard, PiAirplaneInFlightDuotone } from 'react-icons/pi'
import { useTransitionRouter } from 'next-view-transitions'
import { useTransition } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { libAtom } from '../../atoms'
import { Tabs, Tab } from '@heroui/tabs'
import { Drawer, DrawerContent, DrawerHeader, DrawerBody } from '@heroui/drawer'
import { useDisclosure } from '@heroui/react'
import { Input } from '@heroui/input'
import { Button } from '@heroui/button'
import { getArticleFromUrl } from '@/lib/utils'
import { useState } from 'react'
import { isLoadingAtom } from '../../[text]/atoms'
import isUrl from 'is-url'
import moment from 'moment-timezone'
import Topics from '../../[text]/components/topics'
import Link from "next/link"

function Text({ id, title, topics, hasEbook, createdAt, updatedAt }: {
    id: string,
    title: string,
    topics: string[],
    hasEbook: boolean,
    createdAt: string,
    updatedAt: string,
}) {
    const lib = useAtomValue(libAtom)
    return (<div className='w-full h-full relative'>
        <Card shadow='sm' fullWidth className='h-full' as={Link} prefetch href={`/library/${lib}/${id}`} isPressable>
            <CardBody className='flex flex-col gap-1 p-7'>
                <h2 className='text-2xl text-balance' style={{
                    fontFamily: postFontFamily
                }}>{title}</h2>
                <div className='gap-0.5 flex flex-wrap align-middle items-center'>
                    <Topics topics={topics.concat(hasEbook ? ['电子书'] : [])}></Topics>
                </div>
            </CardBody>
            <CardFooter className='pr-5 pb-4 pt-0 flex flex-col gap-1 items-end'>
                <time className='text-sm text-default-400 font-mono'>Created: {moment(createdAt).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm')}</time>
                <time className='text-sm text-default-400 font-mono'>Updated: {moment(updatedAt).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm')}</time>
            </CardFooter>
        </Card>
    </div>)
}

export function AddTextButton() {
    const lib = useAtomValue(libAtom)
    const router = useTransitionRouter()
    const { isOpen, onOpen, onOpenChange } = useDisclosure()
    const [isImporting, startImporting] = useTransition()
    const [url, setUrl] = useState('')
    const [title, setTitle] = useState('')
    const setIsLoading = useSetAtom(isLoadingAtom)

    return <>
        <Card className='w-full opacity-60 bg-transparent' isPressable shadow='sm' onPress={onOpen}>
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
        </Card>
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
                                    setIsLoading(true)
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
