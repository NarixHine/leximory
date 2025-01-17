'use client'

import { Button } from "@heroui/button"
import { PiPushPinDuotone, PiPushPinFill, } from 'react-icons/pi'
import { isReaderModeAtom } from '@/app/atoms'
import { useAtomValue } from 'jotai'
import { isStarredAtom, libAtom } from '../atoms'
import { useTransition } from 'react'
import { star } from './actions'

export default function Star() {
    const isReaderMode = useAtomValue(isReaderModeAtom)
    const lib = useAtomValue(libAtom)
    const isStarred = useAtomValue(isStarredAtom)
    const [isTransitioning, startTransition] = useTransition()
    return !isReaderMode && <Button
        data-umami-event='钉选文库'
        isLoading={isTransitioning}
        className='pointer-events-auto'
        isIconOnly
        startContent={isTransitioning ? null : isStarred ? <PiPushPinFill /> : <PiPushPinDuotone />}
        variant={'flat'}
        color={'warning'}
        onPress={() => startTransition(() => star(lib))}
    />
}
