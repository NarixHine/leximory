'use client'

import Markdown, { MarkdownProps } from '@/components/markdown'
import { useRef, useState } from 'react'
import { Button } from '@heroui/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PiPlayCircleDuotone } from 'react-icons/pi'
import { generate, retrieve } from './actions'
import { toast } from 'sonner'
import { useAtomValue } from 'jotai'
import { libAtom } from '@/app/library/[lib]/atoms'
import { isReaderModeAtom } from '@/app/atoms'
import { MAX_TTS_LENGTH } from '@repo/env/config'
import { cn } from '@/lib/utils'
import { ms } from 'itty-time'
import AudioPlayer from '@/components/ui/audio-player'

export default function Audio({ id, md, ...props }: {
    id: string,
} & MarkdownProps) {
    const lib = useAtomValue(libAtom)
    const ref = useRef<HTMLDivElement>(null)
    const isReaderMode = useAtomValue(isReaderModeAtom)
    const queryClient = useQueryClient()
    const [isLengthy, setIsLengthy] = useState(false)

    const audioQuery = useQuery({
        queryKey: ['audio', id],
        queryFn: () => retrieve(id),
        staleTime: ms('2 hours'),
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

    const MarkdownComponent = <Markdown hasWrapped md={decodeURIComponent(md)} {...props} className={cn('prose-lg')}></Markdown>

    return isReaderMode ? MarkdownComponent : <div>
        <div className='mt-2'>
            {url || !audioQuery.isSuccess ? <AudioPlayer
                src={url}
            /> : <div className='flex items-center h-14 mt-1'>
                <Button
                    isLoading={status === 'loading' || status === 'generating'}
                    isDisabled={status === 'lengthy'}
                    variant='flat'
                    radius='full'
                    color='primary'
                    size='lg'
                    startContent={<PiPlayCircleDuotone />}
                    onPress={action}
                >
                    {
                        status === 'lengthy' ? `录音文本不多于 ${MAX_TTS_LENGTH} 字` :
                            status === 'loading' ? '加载中' :
                                status === 'ungenerated' ? '生成' :
                                    status === 'generating' ? '生成中' :
                                        status === 'ready' ? 'Ready!' : '未知'
                    }
                </Button>
            </div>}
        </div>
        <div ref={ref} className='mt-5 mb-3'>
            {MarkdownComponent}
        </div>
    </div>
}
