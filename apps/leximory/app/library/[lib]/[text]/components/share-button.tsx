'use client'

import { useCopyToClipboard } from 'usehooks-ts'
import { PiShareNetworkDuotone, PiUsersDuotone, PiClipboardDuotone } from 'react-icons/pi'
import { Button, type ButtonProps } from '@heroui/button'
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { prefixUrl } from '@/lib/config'
import { LibAndTextProps } from '@/lib/types'

export default function ShareButton({ isPublicAndFree, ...props }: ButtonProps & { isPublicAndFree: boolean }) {
    const { lib, text } = useParams() as Awaited<LibAndTextProps['params']>
    const [, copy] = useCopyToClipboard()

    const handlePublicShare = async () => {
        await copy(prefixUrl(`/read/${text}`))
        toast.success('公开分享链接已复制')
    }

    const handleOriginalCopy = async () => {
        await copy(prefixUrl(`/library/${lib}/${text}`))
        toast.success('链接已复制到剪贴板')
    }

    const iconClasses = 'text-xl text-default-500 pointer-events-none shrink-0'

    return (
        <Dropdown>
            <DropdownTrigger>
                <Button
                    variant='light'
                    startContent={<PiShareNetworkDuotone />}
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
            </DropdownMenu>
        </Dropdown>
    )
}
