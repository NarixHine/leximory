'use client'

import { Button } from '@nextui-org/button'
import { Popover, PopoverTrigger, PopoverContent } from '@nextui-org/popover'
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

function updateTheme(rendition: Rendition, theme: 'light' | 'dark', lang: string) {
    const themes = rendition.themes
    themes.fontSize('calc(14px + 0.5vw)')
    themes.override('line-height', '1.6')
    if (lang === 'ja') {
        themes.override('direction', 'ltr')
        themes.fontSize('1.1em')
    }
    if (lang === 'en') {
        themes.font('"Georgia", serif')
    }
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
            updateTheme(themeRendition.current, theme, lang)
        }
    }, [lang, theme])

    const handleFullScreen = useFullScreenHandle()
    const containerRef = useRef<HTMLDivElement>(null!)

    return src && (
        <>
            <Button variant='ghost' color='danger' radius='full' fullWidth onPress={handleFullScreen.enter} startContent={<PiFrameCornersDuotone />}>
                全屏模式
            </Button>
            <FullScreen handle={handleFullScreen} className='h-[80dvh] relative dark:opacity-80 block'>
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
                    readerStyles={theme === 'dark' ? darkReaderTheme : lightReaderTheme}
                    location={location}
                    locationChanged={epubcifi => {
                        setLocation(epubcifi)
                    }}
                    getRendition={rendition => {
                        updateTheme(rendition, theme, lang)
                        rendition.themes.default({
                            'p': {
                                'margin-top': '0.5em',
                                'margin-bottom': '0.5em',
                            }
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
        color: '#ccc',
    },
    titleArea: {
        ...ReactReaderStyle.titleArea,
        color: '#ccc',
    },
    tocArea: {
        ...ReactReaderStyle.tocArea,
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
