'use client'

import getToken from '../actions'
import { toast } from 'sonner'
import { PiKeyDuotone, PiShareDuotone } from 'react-icons/pi'
import { Button } from "@heroui/button"
import { prefixUrl } from '@/lib/config'
import { useState, useTransition } from 'react'
import { Drawer } from 'vaul'
import { Snippet } from "@heroui/snippet"
import { Progress } from "@heroui/progress"
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function CopyToken() {
    const [isLoading, startTransition] = useTransition()
    const [token, setToken] = useState<string | null>(null)
    return <Drawer.Root>
        <Drawer.Trigger
            className={cn('relative flex h-8 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-4 text-sm font-medium shadow transition-all hover:bg-[#FAFAFA] dark:bg-[#161615] dark:hover:bg-[#1A1A19] dark:text-white')}
            onClick={() => {
                setToken(null)
                startTransition(async () => {
                    const token = await getToken()
                    setToken(token)
                })
            }}
        >
            <PiKeyDuotone />
            拷贝
        </Drawer.Trigger>
        <Drawer.Portal>
            <Drawer.Overlay className='fixed inset-0 bg-black/40' />
            <Drawer.Content className='h-fit z-[999] fixed rounded-t-xl bottom-0 left-0 right-0 outline-none bg-default-50 flex flex-col justify-center items-center'>
                <Drawer.Title className='sr-only'>通行密钥</Drawer.Title>
                <div className='p-4 pb-20 md:pb-6 prose prose-sm w-full relative'>
                    {isLoading && <Progress isIndeterminate color='primary' size='sm' className='absolute top-4 left-0 px-6 w-full' />}
                    <Snippet symbol={<PiKeyDuotone className='inline-block mr-3' />} classNames={{
                        base: 'w-full',
                        pre: 'my-0',
                    }}>{token ? token : 'Loading ...'}</Snippet>
                    <p className='text-sm text-gray-500 dark:text-gray-400'>
                        通行密钥用于 <Link href='/blog/ios-shortcuts' target='_blank' className='text-primary-500'>iOS Shortcut</Link> 中向 API 验证你的身份，
                        <br />
                        请妥善保管，不要泄露给他人。
                    </p>
                </div>
            </Drawer.Content>
        </Drawer.Portal>
    </Drawer.Root>
}

export function CopyProfileLink({ userId }: { userId: string }) {
    return <Button
        variant='flat'
        startContent={<PiShareDuotone />}
        size='lg'
        color='primary'
        radius='lg'
        className={cn('border-1')}
        isIconOnly
        onPress={async () => {
            const data: ShareData = {
                title: 'Leximory',
                text: '我在 Leximory 上学语言',
                url: prefixUrl(`/profile/${userId}`),
            }
            if (navigator.canShare(data)) {
                navigator.share(data)
            } else {
                toast.error('浏览器不支持分享功能')
            }
        }}
    />
}
