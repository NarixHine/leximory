'use client'

import Markdown, { MarkdownProps } from '@/components/markdown'
import { useEffect, useRef, useState } from 'react'
import { Button } from "@heroui/button"
import { Card, CardBody } from "@heroui/card"
import { PiPlayCircleDuotone } from 'react-icons/pi'
import { generate, retrieve } from './actions'
import { toast } from 'sonner'
import { useAtomValue } from 'jotai'
import { libAtom } from '@/app/library/[lib]/atoms'
import { isReaderModeAtom } from '@/app/atoms'
import { langAtom } from '@/app/library/[lib]/atoms'
import { MAX_TTS_LENGTH } from '@/lib/config'
import { postFontFamily } from '@/lib/fonts'
import { cn } from '@/lib/utils'

export default function AudioPlayer({ id, md, ...props }: {
    id: string,
} & MarkdownProps) {
    const lib = useAtomValue(libAtom)

    const ref = useRef<HTMLDivElement>(null)
    const [status, setStatus] = useState<'loading' | 'ungenerated' | 'generating' | 'ready' | 'lengthy'>('loading')
    const [url, setUrl] = useState<string | null>(null)
    const lang = useAtomValue(langAtom)

    const isReaderMode = useAtomValue(isReaderModeAtom)

    function action() {
        const { current } = ref
        if (current) {
            if (status === 'ungenerated') {
                const { innerText } = current
                if (innerText.length > MAX_TTS_LENGTH) {
                    setStatus('lengthy')
                    return
                }
                setStatus('generating')
                generate(id, lib, innerText).then((res) => {
                    if (typeof res === 'string') {
                        setUrl(res)
                        setStatus('ready')
                    }
                    else if (res.error) {
                        setStatus('ungenerated')
                        toast.error(res.error)
                    }
                })
            }
        }
    }

    useEffect(() => {
        retrieve(id).then((url) => {
            if (url) {
                setUrl(url)
                setStatus('ready')
            }
            else {
                setStatus('ungenerated')
            }
        })
    }, [id])

    const MarkdownComponent = <Markdown hasWrapped fontFamily={lang === 'en' ? postFontFamily : undefined} md={decodeURIComponent(md)} {...props} className={cn('prose-lg')}></Markdown>

    return isReaderMode ? MarkdownComponent : <Card className='sm:-mx-10 px-5 mt-3 mb-6 bg-transparent' isBlurred>
        <CardBody>
            <div className='mt-2'>
                {url ? <audio
                    controls
                    className='w-full'
                    src={url}
                /> : <Button isLoading={status === 'loading' || status === 'generating'} isDisabled={status === 'lengthy'} variant='flat' radius='full' color='primary' startContent={<PiPlayCircleDuotone />} size='sm' onPress={() => action()}>
                    {
                        status === 'lengthy' ? `录音文本不多于 ${MAX_TTS_LENGTH} 字` :
                            status === 'loading' ? '加载中' :
                                status === 'ungenerated' ? '生成' :
                                    status === 'generating' ? '生成中' :
                                        status === 'ready' ? 'Ready!' : '未知'
                    }
                </Button>}
            </div>
            <div ref={ref} className='mt-5 mb-3'>
                {MarkdownComponent}
            </div>
        </CardBody>
    </Card>
}
