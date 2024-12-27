'use client'

import getToken from './actions'
import { toast } from 'sonner'
import { PiKeyDuotone } from 'react-icons/pi'
import { Button } from '@nextui-org/button'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { useCopyToClipboard } from '@uidotdev/usehooks'

export default function CopyToken() {
    const [, copyToClipboard] = useCopyToClipboard()
    return <Button
        variant='ghost'
        color='warning'
        className={CHINESE_ZCOOL.className}
        startContent={<PiKeyDuotone />}
        onPress={() => {
            const toastId = toast.loading('获取密钥中...', { duration: 1000 })
            getToken().then(async token => {
                if (navigator.clipboard && token) {
                    copyToClipboard(token)
                        .then(() => {
                            toast.dismiss(toastId)
                            toast.success('可以将密钥粘贴到 iOS Shortcuts 中了！')
                        })
                        .catch(() => {
                            toast.dismiss(toastId)
                            toast.error('复制失败')
                        })
                } else {
                    toast.dismiss(toastId)
                    toast.error('复制失败')
                }
            })
        }}
    >
        拷贝通行密钥
    </Button>
}