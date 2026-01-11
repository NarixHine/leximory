'use client'

import { revokeUserToken, getUserToken } from '../actions'
import { toast } from 'sonner'
import { PiKeyDuotone, PiShareDuotone, PiTrashDuotone } from 'react-icons/pi'
import { Button } from "@heroui/button"
import { prefixUrl } from '@repo/env/config'
import { Drawer } from 'vaul'
import { Snippet } from "@heroui/snippet"
import { Progress } from "@heroui/progress"
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function CopyToken() {
    const queryClient = useQueryClient()
    const { data: token, isFetching, refetch } = useQuery({
        queryKey: ['user-token'],
        queryFn: getUserToken,
        enabled: false,
    })
    const { mutate: revoke, isPending: isRevoking } = useMutation({
        mutationFn: revokeUserToken,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user-token'] })
            refetch()
            toast.success('密钥已撤销')
        },
        onError: () => {
            toast.error('撤销失败')
        }
    })
    return <Drawer.Root>
        <Drawer.Trigger
            className={cn('relative flex h-8 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-4 text-sm font-medium shadow transition-all hover:bg-[#FAFAFA] dark:bg-[#161615] dark:hover:bg-[#1A1A19] dark:text-white')}
            onClick={() => refetch()}
        >
            <PiKeyDuotone />
            拷贝
        </Drawer.Trigger>
        <Drawer.Portal>
            <Drawer.Overlay className='fixed inset-0 bg-black/40 dark:bg-white/5' />
            <Drawer.Content className='h-fit z-999 fixed rounded-t-xl bottom-0 left-0 right-0 outline-none bg-background flex flex-col justify-center items-center'>
                <Drawer.Title className='sr-only'>通行密钥</Drawer.Title>
                <div className='p-4 pb-20 md:pb-6 prose prose-sm w-full relative'>
                    {isFetching && <Progress isIndeterminate color='primary' size='sm' className='absolute top-4 left-0 px-6 w-full' />}
                    <Snippet symbol={<PiKeyDuotone className='inline-block mr-3' />} classNames={{
                        base: 'w-full not-prose',
                        pre: 'my-0',
                    }}>{token ? token : 'Loading ...'}</Snippet>
                    <div className='flex gap-2 mt-4'>
                        <Button
                            color='danger'
                            variant='flat'
                            startContent={!isRevoking && <PiTrashDuotone className='size-5' />}
                            isLoading={isRevoking}
                            onPress={() => revoke()}
                        >
                            撤销密钥
                        </Button>
                    </div>
                    <p className='text-default-600 mt-4'>
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
        fullWidth
        startContent={<PiShareDuotone />}
        color='primary'
        radius='lg'
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
    >
        分享学习进度
    </Button>
}
