'use client'

import { Button } from '@nextui-org/button'
import star from './actions'
import { PiPushPinDuotone, PiPushPinFill, } from 'react-icons/pi'
import { isReaderModeAtom } from '@/app/atoms'
import { useAtom, useAtomValue } from 'jotai'
import { isStarredAtom, libAtom } from './atoms'
import { useTransition } from 'react'

export default function Star() {
    const isReaderMode = useAtomValue(isReaderModeAtom)
    const lib = useAtomValue(libAtom)
    const [isStarred, setIsStarred] = useAtom(isStarredAtom)
    const [isTransitioning, startTransition] = useTransition()
    return !isReaderMode && <Button
        data-umami-event='钉选文库'
        isLoading={isTransitioning}
        className='pointer-events-auto'
        isIconOnly
        startContent={isTransitioning ? null : isStarred ? <PiPushPinFill /> : <PiPushPinDuotone />}
        variant={'flat'}
        color={'warning'}
        onPress={() => startTransition(async () => {
            const isStarred = await star(lib)
            setIsStarred(isStarred)
        })}
    />
}
