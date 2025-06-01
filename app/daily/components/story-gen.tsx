'use client'

import { Button } from '@heroui/button'
import { useLogSnag } from '@logsnag/next'
import { PiMagicWandDuotone } from 'react-icons/pi'
import { toast } from 'sonner'
import { Lang, langMap } from '@/lib/config'
import { genStoryInShadowLib } from '../actions'
import { subscribe } from './bell'
import { hasSubsAtom } from '../atoms'
import { useAtomValue } from 'jotai'
import { useTransition } from 'react'

export default function StoryGen({ comments, lang }: {
    comments: string[]
    lang: Lang
}) {
    const { track } = useLogSnag()
    const hasSubs = useAtomValue(hasSubsAtom)
    const [isGenerating, startTransition] = useTransition()
    return <Button
        size='sm'
        variant='light'
        startContent={isGenerating ? null : <PiMagicWandDuotone className='text-xl' />}
        color='primary'
        radius='full'
        isLoading={isGenerating}
        onPress={() => {
            startTransition(async () => {
                genStoryInShadowLib({ comments, lang })
                    .then(async ({ success, message }) => {
                        if (success) {
                            track({
                                channel: 'annotation',
                                event: '生成小故事',
                                icon: '🌪️',
                                tags: {
                                    lang
                                }
                            })
                            toast.success(message, {
                                action: hasSubs ? undefined : {
                                    label: '设置提醒',
                                    onClick: () => {
                                        subscribe(22)
                                    }
                                }
                            })
                        }
                        else {
                            toast.error(message)
                        }
                    })
            })
        }}
    >
        将{langMap[lang]}单词连成文
    </Button>
}
