'use client'

import { Button } from '@nextui-org/react'
import { PiClockClockwiseDuotone } from 'react-icons/pi'
import saveSubs, { delSubs } from './actions'
import { toast } from 'sonner'

export default function Bell({ hasSubscribed }: {
    hasSubscribed: boolean
}) {
    const subscribe = async () => {
        const register = await navigator.serviceWorker.register('/sw.js')

        const subscription = await register.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        })

        await saveSubs(subscription)
    }

    return (
        <div className='flex flex-col justify-center items-center space-y-1'>
            <Button variant={hasSubscribed ? 'solid' : 'ghost'} onPress={hasSubscribed ? () => delSubs() : () => {
                subscribe()
                    .then(() => toast.success('开启成功'))
                    .catch(() => toast.error(`开启失败，iOS 用户请将 Leximory 添加至主界面`))
            }} size='lg' radius='full' color='primary' startContent={<PiClockClockwiseDuotone />}>{`${hasSubscribed ? '关闭' : '开启'} 22:00 日报提醒`}</Button>
            <div className='opacity-50 text-sm text-balance text-center'>
                更换设备后需要重新开启
            </div>
        </div>
    )
}
