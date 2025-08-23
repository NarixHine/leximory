'use client'

import { Button } from '@heroui/button'
import { Divider } from '@heroui/divider'
import { Input } from '@heroui/input'
import { Switch } from '@heroui/switch'
import { Textarea } from '@heroui/input'
import { useState, useTransition } from 'react'
import isUrl from 'is-url'
import { MAX_FILE_SIZE } from '@/lib/config'
import { toast } from 'sonner'
import { FileUpload } from '@/components/ui/upload'
import { saveEbook, generate, save, setAnnotationProgress, generateStory, extractWords } from '../../actions'
import { PiAirplaneInFlightDuotone, PiKanbanDuotone, PiKanbanFill, PiLinkSimpleHorizontalDuotone, PiMagicWandDuotone, PiOptionDuotone, PiOptionFill, PiPlusCircleDuotone, PiTornadoDuotone } from 'react-icons/pi'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { inputAtom, isLoadingAtom, isEditingAtom, ebookAtom, textAtom, hideTextAtom, titleAtom } from '../../atoms'
import { isReadOnlyAtom, langAtom } from '../../../atoms'
import { Tabs, Tab } from '@heroui/tabs'
import { Drawer, DrawerContent, DrawerHeader, DrawerBody } from '@heroui/drawer'
import { useDisclosure } from '@heroui/react'
import { getArticleFromUrl } from '@/lib/utils'
import { getLanguageStrategy } from '@/lib/languages'

export default function ImportModal() {
    const isReadOnly = useAtomValue(isReadOnlyAtom)
    const lang = useAtomValue(langAtom)
    const text = useAtomValue(textAtom)
    const [ebook, setEbook] = useAtom(ebookAtom)
    const [input, setInput] = useAtom(inputAtom)
    const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
    const [editing, setEditing] = useAtom(isEditingAtom)
    const { isOpen, onOpenChange, onOpen } = useDisclosure()
    const [url, setUrl] = useState('')
    const [hideText, setHideText] = useAtom(hideTextAtom)
    const [isPopulating, startPopulating] = useTransition()
    const setTitle = useSetAtom(titleAtom)
    const populate = async () => {
        const { title, content } = await getArticleFromUrl(url)
        setInput(content.replace(/(?<!\!)\[([^\[]+)\]\(([^)]+)\)/g, '$1'))
        save({ id: text, title })
        setTitle(title)
    }
    const { maxArticleLength } = getLanguageStrategy(lang)
    const exceeded = hideText ? false : input.length > maxArticleLength

    const [isGenerating, startGenerating] = useTransition()

    const KanbanSwitch = () => (
        <Switch
            size='lg'
            startContent={<PiKanbanFill />}
            endContent={<PiKanbanDuotone />}
            isDisabled={isLoading}
            isSelected={hideText}
            onValueChange={setHideText}
            color='secondary' />
    )

    const ImportButton = () => (
        <Button
            isDisabled={isReadOnly}
            onPress={onOpen}
            className='flex-1'
            variant='flat'
            radius='full'
            color='primary'
            startContent={<PiMagicWandDuotone className='text-lg' />}
            isLoading={isLoading}
        >
            导入{!ebook ? '材料' : '电子书'}
        </Button>
    )

    const EditSwitch = () => (
        <Switch
            startContent={<PiOptionFill />}
            endContent={<PiOptionDuotone />}
            isDisabled={isReadOnly || isLoading}
            isSelected={editing}
            onValueChange={setEditing}
            color='secondary'
            size='lg'
        />
    )

    return (<>
        <div className='flex flex-col gap-2 mt-2'>
            <div className='flex gap-2'>
                <ImportButton />
                <EditSwitch />
            </div>
            {!ebook && <div className='flex gap-2'>
                <KanbanSwitch />
                <StoryModal />
            </div>}
        </div>
        <Drawer isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={false} placement='bottom' className='bg-default-50'>
            <DrawerContent className='max-h-dvh'>
                {(onClose) => (
                    <form className='w-full'>
                        <DrawerHeader className='flex flex-col gap-1'>导入</DrawerHeader>
                        <DrawerBody className='max-w-(--breakpoint-sm) mx-auto'>
                            <Tabs aria-label='导入方式'>
                                {!ebook && <Tab key='text' title='导入文章' className='flex flex-col gap-2'>
                                    <div className='flex mb-2 gap-0.5 items-end'>
                                        <Input
                                            color='primary'
                                            className='flex-1'
                                            label='网址'
                                            placeholder='https://example.com/'
                                            value={url}
                                            onValueChange={(value) => setUrl(value.trim())}
                                            variant='underlined' />
                                        <Button isLoading={isPopulating} color='primary' radius='full' startContent={isPopulating ? null : <PiLinkSimpleHorizontalDuotone />} onPress={() => startPopulating(populate)} variant='flat' isDisabled={!isUrl(url)}>一键读取</Button>
                                    </div>
                                    <Textarea
                                        errorMessage={exceeded ? `文本长度超过 ${maxArticleLength} 字符` : undefined}
                                        isInvalid={exceeded}
                                        value={input}
                                        label='文本'
                                        description='AI 注解可能含有错误'
                                        rows={15}
                                        onValueChange={setInput}
                                        disableAutosize />
                                    <Switch isDisabled={isReadOnly || isLoading} isSelected={hideText} onValueChange={setHideText} color='secondary'>
                                        仅生成词摘
                                    </Switch>
                                    <Button
                                        className='mt-2'
                                        color='primary'
                                        fullWidth
                                        startContent={<PiAirplaneInFlightDuotone className='text-xl' />}
                                        isDisabled={isLoading || exceeded || isGenerating}
                                        onPress={() => {
                                            startGenerating(async () => {
                                                await setAnnotationProgress({ id: text, progress: 'annotating' })
                                                setIsLoading(true)
                                                onClose()
                                                await generate({ article: input, textId: text, onlyComments: hideText })
                                            })
                                        }}>
                                        生成
                                    </Button>
                                </Tab>}
                                <Tab key='ebook' title='上传电子书' className='flex flex-col gap-2'>
                                    <p className='text-center font-bold text-xl -mb-10'>上传电子书</p>
                                    <FileUpload acceptableTypes={['application/epub+zip']} onChange={async (files) => {
                                        const ebook = files[files.length - 1]
                                        if (ebook.type !== 'application/epub+zip') {
                                            toast.error('发生错误，文件需为 .epub 格式')
                                            return
                                        }
                                        if (ebook.size > MAX_FILE_SIZE) {
                                            toast.error(`发生错误，文件需小于 ${MAX_FILE_SIZE / 1024 / 1024}MB`)
                                            return
                                        }
                                        toast.info('上传中……')
                                        const form = new FormData()
                                        form.append('ebook', ebook)

                                        const src = await saveEbook(text, form)
                                        setEbook(src)
                                        onClose()
                                    }}></FileUpload>
                                </Tab>
                            </Tabs>
                        </DrawerBody>
                    </form>
                )}
            </DrawerContent>
        </Drawer>
    </>)
}

function StoryModal() {
    const { isOpen, onOpenChange, onOpen } = useDisclosure()
    const [words, setWords] = useState<string[]>([''])
    const isReadOnly = useAtomValue(isReadOnlyAtom)
    const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
    const [isGenerating, startGenerating] = useTransition()
    const text = useAtomValue(textAtom)
    const [storyStyle, setStoryStyle] = useState('')
    return <>
        <Button
            className='flex-1'
            isDisabled={isReadOnly}
            isLoading={isLoading}
            radius='full'
            variant='flat'
            color='secondary'
            startContent={<PiTornadoDuotone className='text-lg' />}
            onPress={onOpen}
        >
            连词成文
        </Button>
        <Drawer isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={false} placement='bottom' className='bg-default-50'>
            <DrawerContent className='max-h-dvh'>
                {(onClose) => (
                    <>
                        <DrawerHeader className='flex flex-col gap-1'>连词成文</DrawerHeader>
                        <DrawerBody className='flex flex-col gap-4 max-w-(--breakpoint-sm) mx-auto'>
                            <div className='prose dark:prose-invert'>
                                <blockquote className='not-italic border-l-secondary-300'>
                                    连词成文通过将目标单词串联为故事辅助深度记忆。
                                </blockquote>
                            </div>
                            <p className='text-center font-bold text-xl -mb-10 mt-4'>从图像或文件中提取词汇</p>
                            <FileUpload onChange={async ([file]) => {
                                const form = new FormData()
                                form.append('file', file)
                                const wordsPromise = extractWords(form)
                                toast.promise(wordsPromise, {
                                    loading: '提取重点词汇中……',
                                    success: (words) => {
                                        setWords(words)
                                        return '提取完毕'
                                    },
                                    error: '提取失败'
                                })
                            }}></FileUpload>
                            <div className='flex gap-2 -mt-2 mb-2 items-center'>
                                <Divider className='flex-1'></Divider>
                                <span className='opacity-60'>或</span>
                                <Divider className='flex-1'></Divider>
                            </div>
                            <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 w-full items-center'>
                                {
                                    words.map((word, index) => (
                                        <Input
                                            key={index}
                                            value={word}
                                            variant='flat'
                                            className='col-span-1'
                                            onValueChange={(value) => setWords(words.map((w, i) => i === index ? value : w))}
                                        />
                                    ))
                                }
                                <Button variant='flat' startContent={<PiPlusCircleDuotone />} onPress={() => {
                                    setWords([...words, ''])
                                }}>
                                    手动录入
                                </Button>
                            </div>
                            <Input
                                fullWidth
                                variant='faded'
                                label='故事风格/内容（可选）'
                                value={storyStyle}
                                onValueChange={setStoryStyle}
                            />
                            <Button
                                className='my-2 shrink-0'
                                fullWidth
                                isLoading={isGenerating}
                                color='secondary'
                                startContent={<PiTornadoDuotone />}
                                onPress={() => {
                                    startGenerating(async () => {
                                        setIsLoading(true)
                                        const { success, message } = await generateStory({
                                            comments: words.map(word => `{{${word}||${word}||略}}`),
                                            textId: text,
                                            storyStyle
                                        })
                                        if (success) {
                                            await setAnnotationProgress({ id: text, progress: 'annotating' })
                                            toast.success(message)
                                            onClose()
                                        } else {
                                            toast.error(message)
                                            setIsLoading(false)
                                        }
                                        onClose()
                                    })
                                }}>
                                生成
                            </Button>
                        </DrawerBody>
                    </>
                )}
            </DrawerContent>
        </Drawer>
    </>
}