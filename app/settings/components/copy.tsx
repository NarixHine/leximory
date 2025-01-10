'use client'

import getToken from '../actions'
import { toast } from 'sonner'
import { PiKeyDuotone, PiShareDuotone } from 'react-icons/pi'
import { Button } from '@nextui-org/button'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { useCopyToClipboard } from '@uidotdev/usehooks'
import { prefixUrl } from '@/lib/config'
import { useUser } from '@clerk/nextjs'
import { useState, useTransition } from 'react'
import { Drawer } from 'vaul'
import { Snippet } from '@nextui-org/snippet'
import { Progress } from '@nextui-org/progress'
import { cn } from '@/lib/utils'

export default function CopyToken() {
    const [isLoading, startTransition] = useTransition()
    const [token, setToken] = useState<string | null>(null)
    return <Drawer.Root>
        <Drawer.Trigger
            className={cn('relative flex h-10 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-4 text-sm font-medium shadow-sm transition-all hover:bg-[#FAFAFA] dark:bg-[#161615] dark:hover:bg-[#1A1A19] dark:text-white', CHINESE_ZCOOL.className)}
            onClick={() => {
                setToken(null)
                startTransition(async () => {
                    const token = await getToken()
                    setToken(token)
                })
            }}
        >
            <PiKeyDuotone />
            获取通行密钥
        </Drawer.Trigger>
        <Drawer.Portal>
            <Drawer.Overlay className='fixed inset-0 bg-black/40' />
            <Drawer.Content className='h-fit fixed rounded-t-xl bottom-0 left-0 right-0 outline-none bg-white dark:bg-slate-900 flex flex-col justify-center items-center'>
                <div className='p-4 pb-20 prose prose-sm w-full relative'>
                    {isLoading && <Progress isIndeterminate color='primary' size='sm' className='absolute top-4 left-0 px-6 w-full' />}
                    <Snippet classNames={{
                        base: 'w-full',
                        pre: 'my-0',
                    }}>{token ? token : 'Loading ...'}</Snippet>
                    <p className='text-sm text-gray-500 dark:text-gray-400'>
                        通行密钥用于 iOS Shortcut 中向 API 验证你的身份，
                        <br />
                        请妥善保管，不要泄露给他人。
                    </p>
                </div>
            </Drawer.Content>
        </Drawer.Portal>
    </Drawer.Root>
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
