'use client'

import { useState } from 'react'
import { PiShareNetwork } from 'react-icons/pi'
import { Button, type ButtonProps } from '@heroui/button'
import { LibraryCard } from '../../components/library-card'
import { Lang } from '@repo/schema/library'

interface TextItem {
    emoji: string | null
}

interface LibraryShareButtonProps extends ButtonProps {
    libName: string
    creatorName: string
    lang: Lang
    libId: string
    texts?: TextItem[]
}

export function LibraryShareButton({ libName, creatorName, lang, libId, texts, ...props }: LibraryShareButtonProps) {
    const [isCardOpen, setIsCardOpen] = useState(false)

    return (
        <>
            <Button
                variant='light'
                startContent={<PiShareNetwork />}
                isIconOnly
                radius='full'
                onPress={() => { setIsCardOpen(true) }}
                {...props}
            />

            <LibraryCard
                isOpen={isCardOpen}
                onClose={() => setIsCardOpen(false)}
                libName={libName}
                creatorName={creatorName}
                lang={lang}
                libId={libId}
            />
        </>
    )
}
