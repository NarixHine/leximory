'use client'

import { Button } from '@nextui-org/button'
import { Divider } from '@nextui-org/divider'
import { Input } from '@nextui-org/input'
import { Modal, ModalContent, ModalHeader, ModalBody, useDisclosure } from '@nextui-org/modal'
import { Switch } from '@nextui-org/switch'
import { Textarea } from '@nextui-org/input'
import ky from 'ky'
import { useState } from 'react'
import isUrl from 'is-url'
import { maxArticleLength } from '@/lib/config'
import { toast } from 'sonner'
import { FileUpload } from '@/components/upload'
import { saveTitle, saveEbook, generate, saveContentAndTopics } from './actions'
import { PiLinkSimpleHorizontalDuotone, PiMagicWandDuotone, PiOptionDuotone, PiOptionFill } from 'react-icons/pi'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { inputAtom, isLoadingAtom, isEditingAtom, contentAtom, completionAtom, ebookAtom, textAtom, topicsAtom } from './atoms'
import { isReadOnlyAtom, langAtom, libAtom } from '../atoms'
import { readStreamableValue } from 'ai/rsc'

export const maxEbookSize = 4 * 1024 * 1024

export default function ImportModal() {
    const isReadOnly = useAtomValue(isReadOnlyAtom)
    const lang = useAtomValue(langAtom)
    const lib = useAtomValue(libAtom)
    const text = useAtomValue(textAtom)
    const [ebook, setEbook] = useAtom(ebookAtom)
    const [input, setInput] = useAtom(inputAtom)
    const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
    const [editing, setEditing] = useAtom(isEditingAtom)
    const setContent = useSetAtom(contentAtom)
    const setCompletion = useSetAtom(completionAtom)
    const setTopics = useSetAtom(topicsAtom)
    const { isOpen, onOpenChange, onOpen } = useDisclosure()
    const [url, setUrl] = useState('')
    const populate = async () => {
        const res = await ky.get(url, { prefixUrl: 'https://r.jina.ai' }).text()
        const markdown = (/Markdown Content:\n([\s\S]*)/.exec(res) as string[])[1]
        const title = (/^Title: (.+)/.exec(res) as string[])[1]
        setInput(markdown.replace(/(?<!\!)\[([^\[]+)\]\(([^)]+)\)/g, '$1') /* remove links */)
        saveTitle(text, title)
    }
    const exceeded = input.length > maxArticleLength(lang)

    return (<>
        <div className='px-3 flex justify-center gap-3'>
            <Button isDisabled={isReadOnly} onPress={onOpen} className='flex-1' variant='flat' color='primary' startContent={<PiMagicWandDuotone />} isLoading={isLoading}>导入{!ebook ? '文本／' : ''}电子书</Button>
            {!ebook && <Switch startContent={<PiOptionFill />} endContent={<PiOptionDuotone />} isDisabled={isReadOnly || isLoading} isSelected={editing} onValueChange={setEditing} color='secondary'>
                修正模式
            </Switch>}
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
                                    <Button color='primary' radius='full' endContent={<PiLinkSimpleHorizontalDuotone />} onPress={populate} variant='flat' isDisabled={!isUrl(url)}>一键读取</Button>
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
                                <Button
                                    data-umami-event='文章注解'
                                    color='primary'
                                    fullWidth
                                    isDisabled={isLoading || exceeded}
                                    onPress={async () => {
                                        setIsLoading(true)
                                        const { object, error } = await generate(input, lib)
                                        onClose()

                                        if (error) {
                                            toast.error(error)
                                            setIsLoading(false)
                                        }
                                        else if (object) {
                                            let commentary = '', topics = []
                                            try {
                                                for await (const partialObject of readStreamableValue(object)) {
                                                    if (partialObject) {
                                                        commentary = partialObject.commentary
                                                        setCompletion(partialObject.commentary)
                                                        topics = partialObject.topics
                                                    }
                                                }
                                                setContent(commentary)
                                                setTopics(topics)
                                                await saveContentAndTopics(text, commentary, topics)
                                                setIsLoading(false)
                                            } catch (e) {
                                                await saveContentAndTopics(text, commentary, topics)
                                                toast.error('生成中止。')
                                                setIsLoading(false)
                                            }
                                        }
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
