'use client'

import { isReaderModeAtom } from '@/app/atoms'
import { useAtomValue } from 'jotai'

export default function MdImg({ src, alt = 'Image', title }: {
    src: string,
    alt?: string,
    title?: string
}) {
    const isReaderMode = useAtomValue(isReaderModeAtom)
    return isReaderMode ? <></> : (
        <img
            title={title}
            alt={alt}
            src={src}
            className='shadow rounded-lg block mx-auto'
        />
    )
}