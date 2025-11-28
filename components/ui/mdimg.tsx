'use client'

import { isReaderModeAtom } from '@/app/atoms'
import { Button } from '@heroui/button'
import { Image } from '@heroui/image'
import { useAtomValue } from 'jotai'
import { useState } from 'react'
import { PiEyeSlash } from 'react-icons/pi'

export default function MdImg({ src, alt = 'Image', title, disableSpecialStyles }: {
    src: string,
    alt?: string,
    title?: string,
    disableSpecialStyles?: boolean
}) {
    const isReaderMode = useAtomValue(isReaderModeAtom)
    const [isHidden, setIsHidden] = useState(false)
    if (isReaderMode && isHidden) {
        return <></>
    }

        const enableSpecialStyles = !isReaderMode && !disableSpecialStyles
    return (
        <div className='relative mx-auto w-fit'>
            <Image
                isBlurred={enableSpecialStyles}
                isZoomed={enableSpecialStyles}
                title={title}
                alt={alt}
                src={src}
            />
            {isReaderMode && (
                <Button
                    isIconOnly
                    size='sm'
                    className='absolute top-2 right-2 z-10 print:hidden'
                    onPress={() => setIsHidden(true)}
                    startContent={<PiEyeSlash />}
                />
            )}
        </div>
    )
}
