'use client'

import { useCopyToClipboard } from 'usehooks-ts'
import { PiShareNetworkDuotone, PiLink, PiUsers } from 'react-icons/pi'
import { Button, type ButtonProps } from '@heroui/button'
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react'
import { useParams } from 'next/navigation'
import { getPublicShareLink } from './share-actions'
import { toast } from 'sonner'
import { prefixUrl } from '@/lib/config'
import { LibAndTextProps } from '@/lib/types'

export default function ShareButton(props: ButtonProps) {
    const { lib, text } = useParams() as Awaited<LibAndTextProps['params']>
    const [, copy] = useCopyToClipboard()

    const handlePublicShare = async () => {
        const promise = getPublicShareLink(text)

        toast.promise(promise, {
            loading: '正在验证文库访问权限……',
            success: async (url) => {
                await copy(url)
                return '公开分享链接已复制到剪贴板'
            },
            error: () => '只有集市免费文库才可公开分享'
        })
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
            <DropdownMenu aria-label='Share options' variant='faded'>
                <DropdownItem
                    key='original'
                    onPress={handleOriginalCopy}
                    startContent={<PiLink className={iconClasses} />}
                >
                    复制原始链接
                </DropdownItem>
                <DropdownItem
                    key='public'
                    onPress={handlePublicShare}
                    startContent={<PiUsers className={iconClasses} />}
                    description='供未注册用户访问'
                >
                    复制公开链接
                </DropdownItem>
            </DropdownMenu>
        </Dropdown>
    )
}
