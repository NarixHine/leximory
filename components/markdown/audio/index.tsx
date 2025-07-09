'use client'

import Markdown, { MarkdownProps } from '@/components/markdown'
import { useRef, useState } from 'react'
import { Button } from "@heroui/button"
import { Card, CardBody } from "@heroui/card"
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PiPlayCircleDuotone } from 'react-icons/pi'
import { generate, retrieve } from './actions'
import { toast } from 'sonner'
import { useAtomValue } from 'jotai'
import { libAtom } from '@/app/library/[lib]/atoms'
import { isReaderModeAtom } from '@/app/atoms'
import { langAtom } from '@/app/library/[lib]/atoms'
import { MAX_TTS_LENGTH } from '@/lib/config'
import { contentFontFamily } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { ms } from 'itty-time'

export default function AudioPlayer({ id, md, ...props }: {
    id: string,
} & MarkdownProps) {
    const lib = useAtomValue(libAtom)
    const ref = useRef<HTMLDivElement>(null)
    const lang = useAtomValue(langAtom)
    const isReaderMode = useAtomValue(isReaderModeAtom)
    const queryClient = useQueryClient()
    const [isLengthy, setIsLengthy] = useState(false)

    const audioQuery = useQuery({
        queryKey: ['audio', id],
        queryFn: () => retrieve(id),
        staleTime: ms('20 minutes'),
    })

    const generateMutation = useMutation({
        mutationFn: (innerText: string) => generate(id, lib, innerText),
        onSuccess: (res) => {
            if (typeof res === 'string') {
                queryClient.invalidateQueries({ queryKey: ['audio', id] })
            } else if (res.error) {
                toast.error(res.error)
            }
        },
        onError: () => {
            toast.error('生成失败')
        }
    })

    function action() {
        const { current } = ref
        if (current) {
            const { innerText } = current
            if (innerText.length > MAX_TTS_LENGTH) {
                setIsLengthy(true)
                return
            }
            generateMutation.mutate(innerText)
        }
    }

    const url = audioQuery.data
    const status = (() => {
        if (audioQuery.isLoading) return 'loading'
        if (generateMutation.isPending) return 'generating'
        if (isLengthy) return 'lengthy'
        if (audioQuery.isSuccess && !url) return 'ungenerated'
        if (audioQuery.isSuccess && !!url) return 'ready'
        return 'ungenerated'
    })()

    const MarkdownComponent = <Markdown hasWrapped fontFamily={lang === 'en' ? contentFontFamily : undefined} md={decodeURIComponent(md)} {...props} className={cn('prose-lg')}></Markdown>

    return isReaderMode ? MarkdownComponent : <Card className='sm:-mx-10 px-5 mt-3 mb-6 bg-transparent' isBlurred>
        <CardBody>
            <div className='mt-2'>
                {url ? <audio
                    controls
                    className='w-full'
                    src={url}
                /> : <Button isLoading={status === 'loading' || status === 'generating'} isDisabled={status === 'lengthy'} variant='flat' radius='full' color='primary' startContent={<PiPlayCircleDuotone />} size='sm' onPress={action}>
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
