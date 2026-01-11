'use client'

import { isReaderModeAtom } from '@/app/atoms'
import { Button } from '@heroui/button'
import Image from 'next/image'
import { useAtomValue } from 'jotai'
import { useState } from 'react'
import { PiEyeSlash } from 'react-icons/pi'
import { ALLOWED_IMAGE_REMOTE_PATTERNS } from '@repo/env/config'

export default function MdImg({ src, alt = 'Image', title }: {
    src: string,
    alt?: string,
    title?: string,
}) {
    const isReaderMode = useAtomValue(isReaderModeAtom)
    const [isHidden, setIsHidden] = useState(false)
    if (isReaderMode && isHidden) {
        return <></>
    }

    return (
        <div className='mx-auto w-full'>
            <Image
                sizes='(max-width: 768px) 100vw, 800px'
                title={title}
                width={0}
                height={0}
                alt={alt}
                src={src}
                className='rounded-lg'
                unoptimized={!ALLOWED_IMAGE_REMOTE_PATTERNS.some(pattern => {
                    if (src.startsWith('/'))
                        return true
                    return pattern.hostname === new URL(src).hostname && pattern.protocol === new URL(src).protocol
                })}
                loading='lazy'
                style={{ width: '100%', height: 'auto' }}
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
