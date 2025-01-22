'use client'

import { Button } from "@heroui/button"
import { PiPushPinDuotone, PiPushPinFill, } from 'react-icons/pi'
import { isReaderModeAtom } from '@/app/atoms'
import { useAtomValue } from 'jotai'
import { isStarredAtom, langAtom, libAtom } from '../atoms'
import { useTransition } from 'react'
import { star } from './actions'
import { useLogSnag } from '@logsnag/next'

export default function Star() {
    const isReaderMode = useAtomValue(isReaderModeAtom)
    const lib = useAtomValue(libAtom)
    const isStarred = useAtomValue(isStarredAtom)
    const lang = useAtomValue(langAtom)
    const [isTransitioning, startTransition] = useTransition()
    const { track } = useLogSnag()
    return !isReaderMode && <Button
        isLoading={isTransitioning}
        className='pointer-events-auto'
        isIconOnly
        startContent={isTransitioning ? null : isStarred ? <PiPushPinFill /> : <PiPushPinDuotone />}
        variant={'flat'}
        color={'warning'}
        onPress={() => {
            track({
                event: isStarred ? '取消钉选文库' : '钉选文库',
                channel: 'resource-sharing',
                icon: '📍',
                description: `钉选了 ${lib}`,
                tags: { lib, lang }
            })
            startTransition(() => star(lib))
        }}
    />
}
