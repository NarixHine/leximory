'use client'

import { Button } from '@heroui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@heroui/popover'
import { CircularProgress } from '@heroui/progress'
import type { Contents, Rendition } from 'epubjs'
import { PiBookmarkDuotone, PiFrameCornersDuotone, PiMagnifyingGlassDuotone } from 'react-icons/pi'
import { IReactReaderStyle, ReactReader, ReactReaderStyle } from 'react-reader'
import Comment from '@/components/comment'
import { getLanguageStrategy } from '@/lib/languages/strategies'
import { cn } from '@/lib/utils'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useSystemColorMode } from 'react-use-system-color-mode'
import { contentAtom, ebookAtom, textAtom, titleAtom } from '../../atoms'
import { isReadOnlyAtom, langAtom } from '../../../atoms'
import { useAtom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useFullScreenHandle, FullScreen } from 'react-full-screen'
import { atomFamily } from 'jotai/utils'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { memo } from 'react'
import { save } from '../../actions'
import { getBracketedSelection } from '@/components/define/utils'

function transformEbookUrl(url: string) {
    const match = url.match(/\/ebooks\/([^/]+)\.epub\?token=([^&]+)/)
    if (match) {
        const [, id, token] = match
        return `/ebooks/${token}/${id}.epub`
    }
    return url
}

const locationAtomFamily = atomFamily((text: string) =>
    atomWithStorage<string | number>(`persist-location-${text}`, 0)
)

function updateTheme(rendition: Rendition, theme: 'light' | 'dark') {
    const themes = rendition.themes
    themes.override('direction', 'ltr')
    switch (theme) {
        case 'dark': {
            themes.override('color', '#CECDC3')
            themes.override('background', '#100F0F')
            break
        }
        case 'light': {
            themes.override('color', '#100F0F')
            themes.override('background', '#FFFCF0')
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
                    color='primary'
                    variant='light'
                    size='lg'
                    isIconOnly
                    radius='lg'
                    isDisabled={!prompt}
                    startContent={<PiMagnifyingGlassDuotone className='text-lg' />}
                />
            </PopoverTrigger>
            <PopoverContent className='sm:w-80 w-60 p-0 bg-transparent'>
                {prompt && <Comment asCard prompt={prompt} params='["", "↺ Loading ..."]'></Comment>}
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
    const strategy = useMemo(() => getLanguageStrategy(lang), [lang])

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
                zIndex: isFullViewport ? 999 : 0,
                left: isFullViewport ? 0 : 'auto',
                top: isFullViewport ? 0 : 'auto',
                padding: isFullViewport ? 15 : 0,
                right: isFullViewport ? 0 : 'auto',
            }}
            transition={{
                duration: 0.5,
                ease: 'easeInOut',
                layout: {
                    duration: 0.5
                }
            }}
            layout='preserve-aspect'
        >
            <FullScreen handle={handleFullScreen} className={cn('relative dark:opacity-95 block', isFullViewport ? 'h-[calc(100dvh-40px)]' : 'h-[80dvh]')}>
                <div ref={containerRef} className='flex absolute top-2 right-2 gap-1'>
                    <Button
                        isIconOnly
                        startContent={<PiFrameCornersDuotone className='text-lg' />}
                        className='z-10'
                        color='primary'
                        variant='light'
                        size='lg'
                        radius='lg'
                        onPress={async () => {
                            try {
                                await handleFullScreen.enter()
                            } catch {
                                setIsFullViewport(!isFullViewport)
                            }
                        }}
                    />
                    <Button
                        startContent={!savingBookmark && <PiBookmarkDuotone className='text-lg' />}
                        isLoading={savingBookmark}
                        isDisabled={!bookmark || isReadOnly}
                        className='z-10'
                        color='primary'
                        variant='light'
                        size='lg'
                        radius='lg'
                        isIconOnly
                        onPress={() => {
                            if (bookmark) {
                                startSavingBookmark(async () => {
                                    try {
                                        const newContent = content.concat(bookmark)
                                        await save({ id: text, content: newContent })
                                        setContent(newContent)
                                        toast.success('文摘已保存')
                                    } catch {
                                        toast.error('文摘保存失败，请重试')
                                    }
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
                    isRTL={strategy.isRTL}
                    readerStyles={theme === 'dark' ? darkReaderTheme : lightReaderTheme}
                    location={location}
                    locationChanged={epubcifi => {
                        setLocation(epubcifi)
                        if (themeRendition.current) {
                            const { displayed } = themeRendition.current.location.start
                            setPage(strategy.pageFormat?.(displayed.page, displayed.total) ?? '')
                        }
                    }}
                    getRendition={rendition => {
                        updateTheme(rendition, theme)
                        rendition.themes.default({
                            'p': {
                                'margin-top': '0.6em',
                                'margin-bottom': '0.6em',
                                'font-size': '24px !important',
                                'font-family': '"Athelas", Georgia, serif !important',
                                'line-height': strategy.lineHeight,
                                'text-rendering': 'optimizeLegibility',
                            },
                            'div': {
                                'font-size': '24px !important',
                                'font-family': '"Athelas", Georgia, serif !important',
                                'line-height': strategy.lineHeight,
                                'text-rendering': 'optimizeLegibility',
                            },
                            'h1': {
                                'font-family': '"Baskerville", Georgia, serif !important',
                            },
                            'h2': {
                                'font-family': '"Baskerville", Georgia, serif !important',
                            },
                            'h3': {
                                'font-family': '"Baskerville", Georgia, serif !important',
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
                    url={transformEbookUrl(src)}
                />
            </FullScreen>
        </motion.div>
    )
}

const lightReaderTheme: IReactReaderStyle = {
    ...ReactReaderStyle,
    readerArea: {
        ...ReactReaderStyle.readerArea,
        backgroundColor: '#FFFCF0',
        transition: undefined,
    },
    tocArea: {
        ...ReactReaderStyle.tocArea,
        background: '#FFFCF0',
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
        backgroundColor: '#100F0F',
        transition: undefined,
        color: '#ccc !important',
    },
    titleArea: {
        ...ReactReaderStyle.titleArea,
        color: '#ccc',
    },
    tocArea: {
        ...ReactReaderStyle.tocArea,
        background: '#100F0F',
    },
    container: {
        ...ReactReaderStyle.container,
        background: '#100F0F',
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
