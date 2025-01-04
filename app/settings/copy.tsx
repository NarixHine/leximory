'use client'

import getToken from './actions'
import { toast } from 'sonner'
import { PiKeyDuotone, PiShareDuotone } from 'react-icons/pi'
import { Button } from '@nextui-org/button'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { useCopyToClipboard } from '@uidotdev/usehooks'
import { prefixUrl } from '@/lib/config'
import { useUser } from '@clerk/nextjs'
import { useTransition } from 'react'

export default function CopyToken() {
    const [isLoading, startTransition] = useTransition()
    return <Button
        variant='ghost'
        color='warning'
        className={CHINESE_ZCOOL.className}
        startContent={isLoading ? null : <PiKeyDuotone />}
        isLoading={isLoading}
        onPress={() => {
            startTransition(async () => {
                const token = await getToken()
                if (token) {
                    const isIOS = navigator.userAgent.match(/iPhone|iPad|iPod/i)
                    if (isIOS) {
                        // iOS seems to limit the text length of clipboard.writeText
                        navigator.share({
                            text: token
                        })
                    } else {
                        navigator.clipboard.writeText(token)
                    }
                    toast.success('可以将密钥粘贴到 iOS Shortcuts 中了！')
                } else {
                    toast.error('获取密钥失败')
                }
            })
        }}
    >
        拷贝通行密钥
    </Button>
}

export function CopyProfileLink() {
    const [, copyToClipboard] = useCopyToClipboard()
    const { user } = useUser()
    return <Button
        variant='flat'
        color='secondary'
        onPress={async () => {
            if (user) {
                await copyToClipboard(prefixUrl(`/profile/${user.id}`))
                toast.success('复制成功')
            }
        }}
        isIconOnly
    >
        <PiShareDuotone />
    </Button>
}
