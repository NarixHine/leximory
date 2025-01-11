'use client'

import { Button } from '@nextui-org/button'
import { PiClockClockwiseDuotone } from 'react-icons/pi'
import { toast } from 'sonner'
import env from '@/lib/env'
import { save, remove } from '../actions'
import { useTransition } from 'react'
import { PushSubscription } from 'web-push'

export default function Bell({ hasSubscribed }: {
    hasSubscribed: boolean
}) {
    const [isUpdating, startUpdating] = useTransition()
    const subscribe = async () => {
        const register = await navigator.serviceWorker.register('/sw.js')

        const subscription = await register.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        })

        await save(subscription as unknown as PushSubscription)
    }

    return (
        <div className='flex flex-col justify-center items-center space-y-1'>
            <Button variant={hasSubscribed ? 'solid' : 'ghost'} isLoading={isUpdating} onPress={() => {
                startUpdating(async () => {
                    if (hasSubscribed) {
                        await remove()
                    } else {
                        try {
                            await subscribe()
                            toast.success('开启成功')
                        } catch {
                            toast.error(`开启失败，iOS 用户请将 Leximory 添加至主界面`)
                        }
                    }
                })
            }} size='lg' radius='full' color='primary' startContent={isUpdating ? null : <PiClockClockwiseDuotone />}>{`${hasSubscribed ? '关闭' : '开启'} 21:30 日报提醒`}</Button>
            <div className='opacity-50 text-sm text-balance text-center'>
                更换设备后需要重新开启
            </div>
        </div>
    )
}
