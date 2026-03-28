'use client'

import { useCopyToClipboard } from 'usehooks-ts'
import { PiShareNetwork, PiUsersDuotone, PiClipboardDuotone, PiImageDuotone } from 'react-icons/pi'
import { Button, type ButtonProps } from '@heroui/button'
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { prefixUrl } from '@repo/env/config'
import { LibAndTextProps } from '@/lib/types'
import { useAtomValue } from 'jotai'
import { useDisclosure } from '@heroui/modal'
import { isEditingAtom } from '../atoms'
import { titleAtom, contentAtom, emojiAtom } from '../atoms'
import { ArticleCard } from '@/app/library/components/article-card'
import { Lang } from '@repo/schema/library'

interface ShareButtonProps extends ButtonProps {
    isPublicAndFree: boolean
    libName: string
    libId: string
    lang: Lang
}

export default function ShareButton({ isPublicAndFree, libName, libId, lang, ...props }: ShareButtonProps) {
    const { lib, text } = useParams() as Awaited<LibAndTextProps['params']>
    const [, copy] = useCopyToClipboard()
    const { isOpen, onOpen, onClose } = useDisclosure({})

    const isEditing = useAtomValue(isEditingAtom)
    const title = useAtomValue(titleAtom)
    const content = useAtomValue(contentAtom)
    const emoji = useAtomValue(emojiAtom)

    const handlePublicShare = async () => {
        await copy(prefixUrl(`/read/${text}`))
        toast.success('公开分享链接已复制')
    }

    const handleOriginalCopy = async () => {
        await copy(prefixUrl(`/library/${lib}/${text}`))
        toast.success('链接已复制到剪贴板')
    }

    const iconClasses = 'text-xl text-default-500 pointer-events-none shrink-0'

    return isEditing ? null : (
        <>
            <Dropdown>
                <DropdownTrigger>
                    <Button
                        variant='light'
                        startContent={<PiShareNetwork />}
                        isIconOnly
                        {...props}
                    />
                </DropdownTrigger>
                <DropdownMenu aria-label='Share options' variant='faded' disabledKeys={isPublicAndFree ? [] : ['public']}>
                    <DropdownItem
                        key='original'
                        onPress={handleOriginalCopy}
                        startContent={<PiClipboardDuotone className={iconClasses} />}
                    >
                        复制原始链接
                    </DropdownItem>
                    <DropdownItem
                        key='public'
                        onPress={handlePublicShare}
                        startContent={<PiUsersDuotone className={iconClasses} />}
                        description={isPublicAndFree ? '供未注册用户访问' : '只有集市免费文库才可公开分享'}
                    >
                        复制公开链接
                    </DropdownItem>
                    <DropdownItem
                        key='card'
                        onPress={onOpen}
                        startContent={<PiImageDuotone className={iconClasses} />}
                    >
                        分享二维码卡片
                    </DropdownItem>
                </DropdownMenu>
            </Dropdown>

            <ArticleCard
                isOpen={isOpen}
                onClose={onClose}
                title={title}
                libName={libName}
                libId={libId}
                textId={text as string}
                content={content}
                emoji={emoji}
                lang={lang}
            />
        </>
    )
}
