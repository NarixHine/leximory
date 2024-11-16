'use client'

import { Button, Popover, PopoverTrigger, PopoverContent, Spacer, CircularProgress } from '@nextui-org/react'
import type { Contents, Rendition } from 'epubjs'
import { PiFrameCornersDuotone, PiMagnifyingGlassDuotone } from 'react-icons/pi'
import { IReactReaderStyle, ReactReader, ReactReaderStyle } from 'react-reader'
import Comment from '@/components/comment'
import { cn, getSelectedChunk } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { useSystemColorMode } from 'react-use-system-color-mode'
import { ebookAtom, textAtom, titleAtom } from './atoms'
import { langAtom } from '../atoms'
import { useAtom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useFullScreenHandle, FullScreen } from 'react-full-screen'
import { atomFamily } from 'jotai/utils'
import { motion } from 'framer-motion'

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

export default function Ebook() {
    const title = useAtomValue(titleAtom)
    const text = useAtomValue(textAtom)
    const lang = useAtomValue(langAtom)
    const src = useAtomValue(ebookAtom)
    const [location, setLocation] = useAtom(locationAtomFamily(text))

    const [prompt, setPrompt] = useState<string | null>(null)
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
                zIndex: isFullViewport ? 999 : 'auto'
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
            <Button variant={isFullViewport ? 'flat' : 'ghost'} size={isFullViewport ? 'sm' : 'md'} color='primary' radius='full' fullWidth onPress={async () => {
                try {
                    await handleFullScreen.enter()
                } catch {
                    setIsFullViewport(!isFullViewport)
                }
            }}
                startContent={<PiFrameCornersDuotone />}
            >
                全屏模式
            </Button>
            <Spacer />
            <FullScreen handle={handleFullScreen} className={cn('relative dark:opacity-95 block', isFullViewport ? 'h-[calc(100dvh-40px)]' : 'h-[80dvh]')}>
                <div ref={containerRef}>
                    <Popover placement='right' isDismissable portalContainer={containerRef.current}>
                        <PopoverTrigger>
                            <Button
                                data-umami-event='词汇注解'
                                className='absolute top-1 right-1 bg-background'
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
                            setPrompt(selection ? getSelectedChunk(selection) : null)
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
