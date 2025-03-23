'use client'

import { isReaderModeAtom } from '@/app/atoms'
import { Image } from "@heroui/image"
import { useAtomValue } from 'jotai'

export default function MdImg({ src, alt = 'Image', title }: {
    src: string,
    alt?: string,
    title?: string
}) {
    const isReaderMode = useAtomValue(isReaderModeAtom)
    return isReaderMode ? <></> : (
        <Image
            isZoomed
            title={title}
            alt={alt}
            src={src}
            className='mx-auto'
        />
    )
}
