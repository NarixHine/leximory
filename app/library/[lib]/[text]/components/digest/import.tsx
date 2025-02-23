'use client'

import { Button } from "@heroui/button"
import { Divider } from "@heroui/divider"
import { Input } from "@heroui/input"
import { Modal, ModalContent, ModalHeader, ModalBody, useDisclosure, ModalFooter } from "@heroui/modal"
import { Switch } from "@heroui/switch"
import { Textarea } from "@heroui/input"
import ky from 'ky'
import { useState, useTransition } from 'react'
import isUrl from 'is-url'
import { maxArticleLength } from '@/lib/config'
import { toast } from 'sonner'
import { FileUpload } from '@/components/ui/upload'
import { saveEbook, generate, save, setAnnotationProgress, generateStory, extractWords } from '../../actions'
import { PiKanbanDuotone, PiKanbanFill, PiLinkSimpleHorizontalDuotone, PiMagicWandDuotone, PiOptionDuotone, PiOptionFill, PiPlusCircleDuotone, PiTornadoDuotone } from 'react-icons/pi'
import { useAtom, useAtomValue } from 'jotai'
import { inputAtom, isLoadingAtom, isEditingAtom, ebookAtom, textAtom, hideTextAtom } from '../../atoms'
import { isReadOnlyAtom, langAtom, libAtom } from '../../../atoms'
import { useLogSnag } from '@logsnag/next'

export const maxEbookSize = 4 * 1024 * 1024

export default function ImportModal() {
    const lib = useAtomValue(libAtom)
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
    const populate = async () => {
        const res = await ky.get(url, { prefixUrl: 'https://r.jina.ai' }).text()
        const markdown = (/Markdown Content:\n([\s\S]*)/.exec(res) as string[])[1]
        const title = (/^Title: (.+)/.exec(res) as string[])[1]
        setInput(markdown.replace(/(?<!\!)\[([^\[]+)\]\(([^)]+)\)/g, '$1') /* remove links */)
        save({ id: text, title })
    }
    const exceeded = hideText ? false : input.length > maxArticleLength(lang)

    const [isGenerating, startGenerating] = useTransition()

    const { track } = useLogSnag()

    return (<>
        <div className='px-3 flex flex-col gap-2'>
            <div className='flex gap-2'>
                {!ebook && <Switch
                    isDisabled={isReadOnly || isLoading}
                    startContent={<PiKanbanFill />}
                    endContent={<PiKanbanDuotone />}
                    isSelected={hideText}
                    onValueChange={setHideText}
                    color='secondary'
                />}
                <Button
                    isDisabled={isReadOnly}
                    onPress={onOpen}
                    className='flex-1 font-semibold'
                    variant='flat'
                    size='sm'
                    color='primary'
                    startContent={<PiMagicWandDuotone className='text-lg' />}
                    isLoading={isLoading}>
                    导入{!ebook ? '材料' : '电子书'}
                </Button>
            </div>
            <div className='flex gap-2'>
                <StoryModal />
                <Switch
                    startContent={<PiOptionFill />}
                    endContent={<PiOptionDuotone />}
                    isDisabled={isReadOnly || isLoading}
                    isSelected={editing}
                    onValueChange={setEditing}
                    color='secondary'
                />
            </div>
        </div>
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={false} isKeyboardDismissDisabled={true}>
            <ModalContent>
                {(onClose) => (
                    <form className='w-full'>
                        <ModalHeader className='flex flex-col gap-1'>导入</ModalHeader>
                        <ModalBody>
                            {!ebook && <>
                                <div className='flex mb-2 gap-0.5 items-end'>
                                    <Input
                                        color='primary'
                                        className='flex-1'
                                        label='网址'
                                        placeholder='https://example.com/'
                                        value={url}
                                        onValueChange={(value) => setUrl(value.trim())}
                                        variant='underlined' />
                                    <Button isLoading={isPopulating} color='primary' radius='full' endContent={isPopulating ? null : <PiLinkSimpleHorizontalDuotone />} onPress={() => startPopulating(populate)} variant='flat' isDisabled={!isUrl(url)}>一键读取</Button>
                                </div>
                                <Textarea
                                    errorMessage={exceeded ? `文本长度超过 ${maxArticleLength(lang)} 字符` : undefined}
                                    isInvalid={exceeded}
                                    value={input}
                                    label='文本'
                                    description='AI 注解可能含有错误'
                                    rows={5}
                                    onValueChange={setInput}
                                    disableAutosize />
                                <Switch isDisabled={isReadOnly || isLoading} isSelected={hideText} onValueChange={setHideText} color='warning'>
                                    仅生成词摘
                                </Switch>
                                <Button
                                    data-tag-library={lib}
                                    className='mt-2'
                                    color='primary'
                                    fullWidth
                                    isDisabled={isLoading || exceeded || isGenerating}
                                    onPress={() => {
                                        track({
                                            event: '文章注解',
                                            channel: 'annotation',
                                            description: '生成注解',
                                            icon: '📝',
                                            tags: {
                                                lib,
                                                text,
                                                lang
                                            }
                                        })
                                        startGenerating(async () => {
                                            await setAnnotationProgress({ id: text, progress: 'annotating' })
                                            setIsLoading(true)
                                            onClose()
                                            await generate({ article: input, textId: text, onlyComments: hideText })
                                        })
                                    }}>
                                    生成
                                </Button>
                                <div className='flex gap-2 my-2 items-center'>
                                    <Divider className='flex-1'></Divider>
                                    <span className='opacity-60'>或</span>
                                    <Divider className='flex-1'></Divider>
                                </div>
                            </>}
                            <p className='text-center font-bold text-xl -mb-10'>上传电子书</p>
                            <FileUpload acceptableTypes={['application/epub+zip']} onChange={async (files) => {
                                const ebook = files[files.length - 1]
                                if (ebook.type !== 'application/epub+zip') {
                                    toast.error('发生错误，文件需为 .epub 格式。')
                                    return
                                }
                                if (ebook.size > maxEbookSize) {
                                    toast.error(`发生错误，文件需小于 ${maxEbookSize / 1024 / 1024}MB。`)
                                    return
                                }
                                toast.info('上传中……')
                                const form = new FormData()
                                form.append('ebook', ebook)

                                const src = await saveEbook(text, form)
                                setEbook(src)
                                onClose()
                            }}></FileUpload>
                        </ModalBody>
                    </form>
                )}
            </ModalContent>
        </Modal>
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
    const { track } = useLogSnag()
    return <>
        <Button
            className='flex-1 font-semibold'
            isDisabled={isReadOnly}
            isLoading={isLoading}
            size='sm'
            variant='flat'
            color='secondary'
            startContent={<PiTornadoDuotone className='text-lg' />}
            onPress={onOpen}
        >
            连词成文
        </Button>
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={false} isKeyboardDismissDisabled={true}>
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className='flex flex-col gap-1'>连词成文</ModalHeader>
                        <ModalBody className='flex flex-col gap-2'>
                            <div className='prose'><blockquote className='not-italic'>连词成文通过将目标单词串联为故事辅助深度记忆。</blockquote></div>
                            <p className='text-center font-bold text-xl -mb-10 mt-4'>从图像或文件中提取词汇</p>
                            <FileUpload onChange={async ([file]) => {
                                const form = new FormData()
                                form.append('file', file)
                                toast('提取词汇中……')
                                const words = await extractWords(form)
                                setWords(words)
                            }}></FileUpload>
                            <div className='flex gap-2 -mt-2 mb-2 items-center'>
                                <Divider className='flex-1'></Divider>
                                <span className='opacity-60'>或</span>
                                <Divider className='flex-1'></Divider>
                            </div>
                            <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 items-center my-2'>
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
                                variant='flat'
                                label='故事风格/内容（可选）'
                                value={storyStyle}
                                onValueChange={setStoryStyle}
                            />
                        </ModalBody>
                        <ModalFooter className='flex'>
                            <Button className='justify-end' isLoading={isGenerating} color='secondary' startContent={<PiTornadoDuotone />} onPress={() => {
                                track({
                                    channel: 'annotation',
                                    event: '生成小故事',
                                    icon: '🌪️',
                                    tags: {
                                        text,
                                    }
                                })
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
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    </>
}