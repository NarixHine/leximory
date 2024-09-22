'use client'

import { Button, Popover, PopoverTrigger, PopoverContent } from '@nextui-org/react'
import type { Contents, Rendition } from 'epubjs'
import { PiFrameCornersDuotone, PiMagnifyingGlassDuotone } from 'react-icons/pi'
import { IReactReaderStyle, ReactReader, ReactReaderStyle } from 'react-reader'
import Comment from '@/components/comment'
import { getSelectedText } from '@/lib/utils'
import useLocalStorageState from 'use-local-storage-state'
import { useEffect, useRef, useState } from 'react'
import { useSystemColorMode } from 'react-use-system-color-mode'
import { ebookAtom, textAtom, titleAtom } from './atoms'
import { langAtom } from '../atoms'
import { useAtomValue } from 'jotai'
import { useFullScreenHandle, FullScreen } from 'react-full-screen'

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
    const [location, setLocation] = useLocalStorageState<string | number>(`persist-location-${text}`, { defaultValue: 0 })
    const [prompt, setPrompt] = useState<string | null>(null)

    const themeRendition = useRef<Rendition | null>(null)
    const theme = useSystemColorMode()
    useEffect(() => {
        if (themeRendition.current) {
            updateTheme(themeRendition.current, theme)
        }
    }, [lang, theme])

    const handleFullScreen = useFullScreenHandle()
    const containerRef = useRef<HTMLDivElement>(null!)

    return src && (
        <>
            <Button variant='ghost' color='primary' radius='full' fullWidth onPress={handleFullScreen.enter} startContent={<PiFrameCornersDuotone />}>
                全屏模式
            </Button>
            <FullScreen handle={handleFullScreen} className='h-[80vh] relative dark:opacity-95 block'>
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
                    title={title}
                    isRTL={lang === 'ja'}
                    readerStyles={theme === 'dark' ? darkReaderTheme : lightReaderTheme}
                    location={location}
                    locationChanged={epubcifi => {
                        setLocation(epubcifi)
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
                            setPrompt(selection ? getSelectedText(selection) : null)
                        })
                    }}
                    epubOptions={{
                        allowPopups: true,
                        allowScriptedContent: true,
                    }}
                    url={`${src.replace('https://us-east-1.storage.xata.sh/', '/ebooks/')}.epub`}
                />
            </FullScreen>
        </>
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
