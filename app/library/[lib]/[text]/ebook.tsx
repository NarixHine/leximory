'use client'

import { Button } from '@nextui-org/button'
import { Popover, PopoverTrigger, PopoverContent } from '@nextui-org/popover'
import { Spacer } from '@nextui-org/spacer'
import { CircularProgress } from '@nextui-org/progress'
import type { Contents, Rendition } from 'epubjs'
import { PiBookmarkDuotone, PiFrameCornersDuotone, PiMagnifyingGlassDuotone } from 'react-icons/pi'
import { IReactReaderStyle, ReactReader, ReactReaderStyle } from 'react-reader'
import Comment from '@/components/comment'
import { cn, getBracketedSelection } from '@/lib/utils'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useSystemColorMode } from 'react-use-system-color-mode'
import { contentAtom, ebookAtom, textAtom, titleAtom } from './atoms'
import { isReadOnlyAtom, langAtom } from '../atoms'
import { useAtom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useFullScreenHandle, FullScreen } from 'react-full-screen'
import { atomFamily } from 'jotai/utils'
import { motion } from 'framer-motion'
import { updateTextAndRevalidate } from './actions'
import { toast } from 'sonner'
import { memo } from 'react'

const locationAtomFamily = atomFamily((text: string) =>
    atomWithStorage<string | number>(`persist-location-${text}`, 0)
)

function updateTheme(rendition: Rendition, theme: 'light' | 'dark') {
    const themes = rendition.themes
    themes.override('direction', 'ltr')
    switch (theme) {
        case 'dark': {
            themes.override('color', '#fff')
            themes.override('background', '#15202B')
            break
        }
        case 'light': {
            themes.override('color', '#000')
            themes.override('background', '#FAFDF6')
            break
        }
    }
}

const MemoizedPopover = memo(function MemoizedPopover({
    prompt,
    containerRef
}: {
    prompt: string | null
    containerRef: React.RefObject<HTMLDivElement>
}) {
    return (
        <Popover placement='right' isDismissable portalContainer={containerRef.current}>
            <PopoverTrigger>
                <Button
                    data-umami-event='词汇注解'
                    className='bg-background'
                    color='primary'
                    variant='light'
                    size='lg'
                    isIconOnly
                    radius='full'
                    isDisabled={!prompt}
                    startContent={<PiMagnifyingGlassDuotone />}
                />
            </PopoverTrigger>
            <PopoverContent className='sm:w-80 w-60 p-0 bg-transparent'>
                {prompt && <Comment asCard prompt={prompt} params='["", "↺加载中"]'></Comment>}
            </PopoverContent>
        </Popover>
    )
})

export default function Ebook() {
    const title = useAtomValue(titleAtom)
    const text = useAtomValue(textAtom)
    const [content, setContent] = useAtom(contentAtom)
    const lang = useAtomValue(langAtom)
    const src = useAtomValue(ebookAtom)
    const isReadOnly = useAtomValue(isReadOnlyAtom)
    const [location, setLocation] = useAtom(locationAtomFamily(text))

    const [prompt, setPrompt] = useState<string | null>(null)
    const [bookmark, setBookmark] = useState<string | null>(null)
    const [savingBookmark, startSavingBookmark] = useTransition()
    const [page, setPage] = useState('')
    const themeRendition = useRef<Rendition | null>(null)
    const theme = useSystemColorMode()
    useEffect(() => {
        if (themeRendition.current) {
            updateTheme(themeRendition.current, theme)
        }
    }, [lang, theme])

    const handleFullScreen = useFullScreenHandle()
    const [isFullViewport, setIsFullViewport] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null!)

    return src && (
        <motion.div
            className='bg-background'
            style={{
                position: isFullViewport ? 'fixed' : 'relative',
                width: isFullViewport ? '100dvw' : 'auto',
                height: isFullViewport ? '100dvh' : 'auto',
                zIndex: isFullViewport ? 999 : 0
            }}
            transition={{
                duration: 0.5,
                ease: 'easeInOut',
                layout: {
                    duration: 0.5
                }
            }}
            layout='preserve-aspect'
            animate={{
                left: isFullViewport ? 0 : 'auto',
                top: isFullViewport ? 0 : 'auto',
                padding: isFullViewport ? 15 : 0,
                right: isFullViewport ? 0 : 'auto',
            }}
        >
            <Button startContent={<PiFrameCornersDuotone />} variant={isFullViewport ? 'flat' : 'ghost'} size={isFullViewport ? 'sm' : 'md'} color='primary' radius='full' fullWidth onPress={async () => {
                try {
                    await handleFullScreen.enter()
                } catch {
                    setIsFullViewport(!isFullViewport)
                }
            }}>
                全屏模式
            </Button>
            <Spacer />
            <FullScreen handle={handleFullScreen} className={cn('relative dark:opacity-95 block', isFullViewport ? 'h-[calc(100dvh-40px)]' : 'h-[80dvh]')}>
                <div ref={containerRef} className='flex absolute top-2 right-2 gap-1'>
                    <Button
                        data-umami-event='摘录好句'
                        startContent={!savingBookmark && <PiBookmarkDuotone />}
                        isLoading={savingBookmark}
                        isDisabled={!bookmark || isReadOnly}
                        className='bg-background z-10'
                        color='primary'
                        variant='light'
                        size='lg'
                        radius='full'
                        isIconOnly
                        onPress={() => {
                            if (bookmark) {
                                startSavingBookmark(async () => {
                                    const newContent = content.concat(bookmark)
                                    await updateTextAndRevalidate(text, { content: newContent })
                                    setContent(newContent)
                                    toast.success('文摘已保存')
                                })
                            }
                        }}>
                    </Button>
                    <MemoizedPopover
                        prompt={prompt}
                        containerRef={containerRef}
                    />
                </div>
                <ReactReader
                    key={isFullViewport ? 'full' : 'normal'}
                    title={`${title}${page ? ` — ${page}` : ''}`}
                    loadingView={
                        <CircularProgress color='primary' size='lg' className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' />
                    }
                    isRTL={lang === 'ja'}
                    readerStyles={theme === 'dark' ? darkReaderTheme : lightReaderTheme}
                    location={location}
                    locationChanged={epubcifi => {
                        setLocation(epubcifi)
                        if (themeRendition.current) {
                            const { displayed } = themeRendition.current.location.start
                            setPage(lang === 'ja' ? `${displayed.page}/${displayed.total} ページ目` : `At ${displayed.page}/${displayed.total} in Chapter`)
                        }
                    }}
                    getRendition={rendition => {
                        updateTheme(rendition, theme)
                        rendition.themes.default({
                            'p': {
                                'margin-top': '0.6em',
                                'margin-bottom': '0.6em',
                                'font-size': '24px !important',
                                'font-family': '"Georgia", serif !important',
                                'line-height': '1.7 !important',
                            },
                            'div': {
                                'font-size': '24px !important',
                                'font-family': '"Georgia", serif !important',
                                'line-height': '1.7 !important',
                            },
                        })
                        themeRendition.current = rendition
                        rendition.on('selected', (_: string, contents: Contents) => {
                            const selection = contents.window.getSelection()
                            setPrompt(selection ? getBracketedSelection(selection) : null)
                            setBookmark(selection ? `\n\n> ${selection.toString().replaceAll('\n', '\n>\n> ')}` : null)
                        })
                    }}
                    epubOptions={{
                        allowPopups: true,
                        allowScriptedContent: true,
                    }}
                    url={`${src.replace('https://us-east-1.storage.xata.sh/', '/ebooks/')}.epub`}
                />
            </FullScreen>
        </motion.div>
    )
}

const lightReaderTheme: IReactReaderStyle = {
    ...ReactReaderStyle,
    readerArea: {
        ...ReactReaderStyle.readerArea,
        backgroundColor: '#FAFDF6',
        transition: undefined,
    },
    tocArea: {
        ...ReactReaderStyle.tocArea,
        background: '#FAFDF6',
    },
}

const darkReaderTheme: IReactReaderStyle = {
    ...ReactReaderStyle,
    arrow: {
        ...ReactReaderStyle.arrow,
        color: 'white',
    },
    arrowHover: {
        ...ReactReaderStyle.arrowHover,
        color: '#ccc',
    },
    readerArea: {
        ...ReactReaderStyle.readerArea,
        backgroundColor: '#15202B',
        transition: undefined,
        color: '#ccc !important',
    },
    titleArea: {
        ...ReactReaderStyle.titleArea,
        color: '#ccc',
    },
    tocArea: {
        ...ReactReaderStyle.tocArea,
        background: '#15202B',
    },
    container: {
        ...ReactReaderStyle.container,
        background: '#15202B',
    },
    tocButtonExpanded: {
        ...ReactReaderStyle.tocButtonExpanded,
        background: '#222',
    },
    tocButtonBar: {
        ...ReactReaderStyle.tocButtonBar,
    },
    tocButton: {
        ...ReactReaderStyle.tocButton,
        color: 'white',
    },
}
