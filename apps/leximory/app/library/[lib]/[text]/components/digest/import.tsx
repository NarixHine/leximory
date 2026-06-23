'use client'

import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import { Switch } from '@heroui/switch'
import { Textarea } from '@heroui/input'
import { useState, useTransition } from 'react'
import isUrl from 'is-url'
import { MAX_FILE_SIZE } from '@repo/env/config'
import { toast } from 'sonner'
import { FileUpload } from '@/components/ui/upload'
import { saveEbook, generate, saveText, setAnnotationProgressAction } from '@/service/text'
import {
    PiAirplaneInFlight,
    PiKanban,
    PiKanbanFill,
    PiLinkSimpleHorizontal,
    PiMagicWand,
    PiOption,
    PiOptionFill,
} from 'react-icons/pi'
import PhotoImportTab from './photo-import'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
    inputAtom,
    isLoadingAtom,
    isEditingAtom,
    ebookAtom,
    textAtom,
    hideTextAtom,
    titleAtom,
    inlineModeAtom,
} from '../../atoms'
import { isReadOnlyAtom, langAtom } from '../../../atoms'
import { Tabs, Tab } from '@heroui/tabs'
import { Drawer, DrawerContent, DrawerHeader, DrawerBody } from '@heroui/drawer'
import { useDisclosure } from '@heroui/react'
import { getLanguageStrategy } from '@/lib/languages'
import { scrapeArticle } from '@/server/ai/scrape'
import { InlineModeSwitch } from './inline-mode-switch'

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
    const [inlineMode, setInlineMode] = useAtom(inlineModeAtom)
    const [isPopulating, startPopulating] = useTransition()
    const setTitle = useSetAtom(titleAtom)
    const populate = async () => {
        const { title, content } = await scrapeArticle(url)
        setInput(content.replace(/(?<!\!)\[([^\[]+)\]\(([^)]+)\)/g, '$1'))
        saveText({ id: text, content })
        setTitle(title)
    }
    const { maxArticleLength } = getLanguageStrategy(lang)
    const exceeded = hideText ? false : input.length > maxArticleLength

    const [isGenerating, startGenerating] = useTransition()
    const [shouldGenerateTitle, setShouldGenerateTitle] = useState(false)

    const KanbanSwitch = () => {
        // For Classical Chinese (lang === 'zh'), use inline mode toggle
        // For other languages, use hide text mode toggle
        if (lang === 'zh') {
            return <InlineModeSwitch />
        }
        return (
            <Switch
                size='lg'
                startContent={<PiKanbanFill />}
                endContent={<PiKanban />}
                isDisabled={isLoading}
                isSelected={hideText}
                onValueChange={setHideText}
                color='secondary'
            />
        )
    }

    const ImportButton = () => (
        <Button
            isDisabled={isReadOnly}
            onPress={onOpen}
            radius='full'
            fullWidth
            variant={'solid'}
            color={editing ? 'default' : 'primary'}
            startContent={<PiMagicWand className='text-lg' />}
            isLoading={isLoading}
        >
            导入{!ebook ? '材料' : '电子书'}
        </Button>
    )

    const EditSwitch = () => (
        <div className='flex items-center gap-2'>
            <Switch
                startContent={<PiOptionFill />}
                endContent={<PiOption />}
                isDisabled={isReadOnly || isLoading}
                isSelected={editing}
                onValueChange={setEditing}
                color='secondary'
                size='lg'
            />
        </div>
    )

    return (
        <>
            {editing && (
                <div className='text-base font-semibold text-secondary-500 mx-auto text-center'>
                    按右上角保存
                </div>
            )}
            <div className='flex flex-col gap-2 mt-2'>
                <div>
                    <ImportButton />
                </div>
                <div className='flex gap-2 justify-center'>
                    <EditSwitch />
                    <KanbanSwitch />
                </div>
            </div>
            <Drawer
                hideCloseButton
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                placement='bottom'
                className='bg-default-50'
            >
                <DrawerContent className='max-h-dvh rounded-t-4xl'>
                    {onClose => (
                        <form className='w-full'>
                            <DrawerHeader className='flex flex-col gap-1'>导入</DrawerHeader>
                            <DrawerBody className='max-w-(--breakpoint-sm) mx-auto'>
                                <Tabs aria-label='导入方式'>
                                    {!ebook && (
                                        <Tab
                                            key='text'
                                            title='导入文章'
                                            className='flex flex-col gap-2'
                                        >
                                            <div className='flex mb-2 gap-0.5 items-end'>
                                                <Input
                                                    type='url'
                                                    validationBehavior='aria'
                                                    color='secondary'
                                                    className='flex-1'
                                                    label='网址'
                                                    placeholder='https://example.com/'
                                                    value={url}
                                                    onValueChange={value => setUrl(value.trim())}
                                                    variant='underlined'
                                                />
                                                <Button
                                                    radius='full'
                                                    isLoading={isPopulating}
                                                    color='secondary'
                                                    startContent={
                                                        isPopulating ? null : (
                                                            <PiLinkSimpleHorizontal />
                                                        )
                                                    }
                                                    onPress={() => startPopulating(populate)}
                                                    variant='flat'
                                                    isDisabled={!isUrl(url)}
                                                >
                                                    一键读取
                                                </Button>
                                            </div>
                                            <Textarea
                                                errorMessage={
                                                    exceeded
                                                        ? `文本长度超过 ${maxArticleLength} 字符`
                                                        : undefined
                                                }
                                                isInvalid={exceeded}
                                                value={input}
                                                label='文本'
                                                description='AI 注解可能含有错误'
                                                rows={5}
                                                onValueChange={setInput}
                                                disableAutosize
                                            />
                                            <div className='flex flex-wrap gap-6'>
                                                {lang === 'zh' ? (
                                                    <Switch
                                                        isDisabled={isReadOnly || isLoading}
                                                        isSelected={inlineMode}
                                                        onValueChange={setInlineMode}
                                                        color='secondary'
                                                    >
                                                        行内模式
                                                    </Switch>
                                                ) : (
                                                    <Switch
                                                        isDisabled={isReadOnly || isLoading}
                                                        isSelected={hideText}
                                                        onValueChange={setHideText}
                                                        color='secondary'
                                                    >
                                                        仅生成词摘
                                                    </Switch>
                                                )}
                                                <Switch
                                                    isDisabled={isReadOnly || isLoading}
                                                    isSelected={shouldGenerateTitle}
                                                    onValueChange={setShouldGenerateTitle}
                                                    color='secondary'
                                                >
                                                    AI 生成标题
                                                </Switch>
                                            </div>
                                            <Button
                                                className='mt-2'
                                                color='primary'
                                                fullWidth
                                                radius='full'
                                                isLoading={isGenerating}
                                                startContent={
                                                    <PiAirplaneInFlight className='text-xl' />
                                                }
                                                isDisabled={isLoading || exceeded}
                                                onPress={() => {
                                                    startGenerating(async () => {
                                                        await setAnnotationProgressAction({
                                                            id: text,
                                                            progress: 'annotating',
                                                        })
                                                        setIsLoading(true)
                                                        onClose()
                                                        await generate({
                                                            article: input,
                                                            textId: text,
                                                            onlyComments: hideText,
                                                            generateTitle: shouldGenerateTitle,
                                                        })
                                                    })
                                                }}
                                            >
                                                生成
                                            </Button>
                                        </Tab>
                                    )}
                                    <Tab
                                        key='ebook'
                                        title='上传电子书'
                                        className='flex flex-col gap-2'
                                    >
                                        <p className='text-center font-bold text-xl -mb-10'>
                                            上传电子书
                                        </p>
                                        <FileUpload
                                            acceptableTypes={['application/epub+zip']}
                                            onChange={async files => {
                                                const ebook = files[files.length - 1]
                                                if (
                                                    !['application/epub+zip'].includes(ebook.type)
                                                ) {
                                                    toast.error('发生错误，文件需为 .epub 格式')
                                                    return
                                                }
                                                if (ebook.size > MAX_FILE_SIZE) {
                                                    toast.error(
                                                        `发生错误，文件需小于 ${MAX_FILE_SIZE / 1024 / 1024}MB`,
                                                    )
                                                    return
                                                }
                                                toast.info('上传中……')
                                                const form = new FormData()
                                                form.append('ebook', ebook)

                                                const src = await saveEbook(text, form)
                                                setEbook(src)
                                                onClose()
                                            }}
                                        ></FileUpload>
                                    </Tab>
                                    {!ebook && lang === 'zh' && (
                                        <Tab
                                            key='photo'
                                            title='拍照'
                                            className='flex flex-col gap-2'
                                        >
                                            <PhotoImportTab onClose={onClose} />
                                        </Tab>
                                    )}
                                </Tabs>
                            </DrawerBody>
                        </form>
                    )}
                </DrawerContent>
            </Drawer>
        </>
    )
}
