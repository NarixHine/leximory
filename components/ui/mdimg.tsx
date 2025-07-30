'use client'

import { isReaderModeAtom } from '@/app/atoms'
import { Image } from "@heroui/image"
import { useAtomValue } from 'jotai'

export default function MdImg({ src, alt = 'Image', title, disableSpecialStyles }: {
    src: string,
    alt?: string,
    title?: string,
    disableSpecialStyles?: boolean
}) {
    const isReaderMode = useAtomValue(isReaderModeAtom)
    return isReaderMode ? <></> : (
        <Image
            isBlurred={!disableSpecialStyles}
            isZoomed={!disableSpecialStyles}
            title={title}
            alt={alt}
            src={src}
            className='mx-auto'
        />
    )
}
