'use client'

import { PiShareNetwork } from 'react-icons/pi'
import { Button, type ButtonProps } from '@heroui/button'
import { LibraryCard } from '../../components/library-card'
import { Lang } from '@repo/schema/library'
import { useDisclosure } from '@heroui/modal'

interface TextItem {
    emoji: string | null
    id: string
    title: string
}

interface LibraryShareButtonProps extends ButtonProps {
    libName: string
    creatorName: string
    lang: Lang
    libId: string
    texts?: TextItem[]
}

export function LibraryShareButton({ libName, creatorName, lang, libId, texts, ...props }: LibraryShareButtonProps) {
    const { isOpen, onOpen, onClose } = useDisclosure({})

    return (
        <>
            <Button
                variant='light'
                startContent={<PiShareNetwork className='size-5 text-default-400' />}
                isIconOnly
                radius='full'
                onPress={() => { onOpen() }}
                {...props}
            />

            <LibraryCard
                isOpen={isOpen}
                onClose={onClose}
                libName={libName}
                creatorName={creatorName}
                lang={lang}
                libId={libId}
                texts={texts}
            />
        </>
    )
}
