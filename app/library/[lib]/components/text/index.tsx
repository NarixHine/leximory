'use client'

import { CardBody, CardFooter } from "@heroui/card"
import { add, addAndGenerate } from './actions'
import { motion } from 'framer-motion'
import { PiFilePlusDuotone, PiLinkSimpleHorizontal, PiKeyboard, PiCheckSquare, PiSquare } from 'react-icons/pi'
import { useForm } from 'react-hook-form'
import { useAtomValue } from 'jotai'
import { langAtom, libAtom } from '../../atoms'
import { Tabs, Tab } from '@heroui/tabs'
import { Spinner, useDisclosure } from '@heroui/react'
import { Input } from '@heroui/input'
import { getArticleFromUrl } from '@/lib/utils'
import Form from '@/components/form'
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
                <h2 className={'text-2xl text-balance font-formal'}>{title}</h2>
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
    const { isOpen, onOpen, onOpenChange } = useDisclosure()
    const { register, handleSubmit, setValue, formState } = useForm<{ url: string, title: string }>({
        defaultValues: {
            url: '',
            title: ''
        }
    })
    const lang = useAtomValue(langAtom)

    return <>
        <FlatCard className='w-full bg-stone-50/20 dark:bg-stone-800/20 border-stone-200 dark:border-stone-600' isPressable onPress={onOpen}>
            <CardBody className='px-6 pt-5 flex items-center justify-center overflow-hidden'>
                <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                    whileHover={{ scale: 1.1, rotate: 10 }}
                    className='text-7xl h-20 text-stone-700/60 dark:text-stone-200/60 rounded-lg flex items-center justify-center'>
                    <PiFilePlusDuotone />
                </motion.div>
            </CardBody>
        </FlatCard>
        <Form
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title='创建文章'
            isLoading={formState.isSubmitting}
            onSubmit={handleSubmit(async (data) => {
                if (data.url) {
                    try {
                        const { title, content } = await getArticleFromUrl(data.url)
                        if (content.length > getLanguageStrategy(lang).maxArticleLength) {
                            toast.error('识别内容过长，请手动录入')
                            return
                        }
                        await addAndGenerate({ title, content, lib })
                    } catch {
                        toast.error('文章解析失败，请手动录入')
                    }
                } else if (data.title) {
                    await add({ title: data.title, lib })
                }
            })}
        >
            <Tabs aria-label='方式'>
                <Tab
                    key='text'
                    title={
                        <div className='flex items-center space-x-2'>
                            <PiLinkSimpleHorizontal />
                            <span>网址导入外刊</span>
                        </div>
                    }
                >
                    <Input placeholder='https://www.nytimes.com/' variant='bordered' color='primary' {...register('url', {
                        onChange: () => setValue('title', '')
                    })} />
                </Tab>
                <Tab key='ebook'
                    title={
                        <div className='flex items-center space-x-2'>
                            <PiKeyboard />
                            <span>手动输入标题</span>
                        </div>
                    }
                >
                    <Input placeholder='标题' variant='bordered' color='primary' {...register('title', {
                        onChange: () => setValue('url', '')
                    })} />
                </Tab>
            </Tabs>
        </Form>
    </>
}

export default Text
