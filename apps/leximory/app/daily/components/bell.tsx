'use client'

import { Button } from "@heroui/button"
import { PiClockClockwiseDuotone } from 'react-icons/pi'
import { toast } from 'sonner'
import env from '@repo/env'
import { save, remove } from '../actions'
import { PushSubscription } from 'web-push'
import { useState } from 'react'
import { Select, SelectItem } from '@heroui/select'
import { urlB64ToUint8Array } from '@/lib/utils'

export const subscribe = async (hour: number) => {
    // 1. Grab existing registration (don't try to register again here)
    const registration = await navigator.serviceWorker.getRegistration()

    if (!registration) {
        // Fallback: if it's not there, try one quick registration
        await navigator.serviceWorker.register('/sw.js')
        throw new Error('正在初始化服务，请稍后再试一次')
    }

    // 2. Request Permission - MUST be close to the click event
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('权限被拒绝')

    // 3. Ensure the SW is active before calling pushManager
    // iOS will fail if you call subscribe on an "installing" worker
    if (registration.installing) {
        toast.info('正在安装服务...')
        await new Promise((resolve) => {
            registration.installing?.addEventListener('statechange', (e) => {
                if ((e.target as ServiceWorker).state === 'activated') resolve(null)
            })
        })
    }

    const applicationServerKey = urlB64ToUint8Array(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)

    // 4. The actual subscription
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
    })

    await save({ subs: subscription.toJSON() as PushSubscription, hour })
}

export default function BellButton({ hasSubs, hour = 22, isDisabled }: {
    hasSubs: boolean
    hour?: number | null
    isDisabled?: boolean
}) {
    const [isLoading, setIsLoading] = useState(false)
    const [selectedHour, setSelectedHour] = useState(hour ?? 22)

    const handleToggle = async () => {
        setIsLoading(true)
        try {
            if (hasSubs) {
                await remove()
            } else {
                await subscribe(selectedHour)
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : '开启失败，iOS 用户请将 Leximory 添加至主界面')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className='flex gap-2 items-center justify-center'>
            <Button
                variant={hasSubs ? 'flat' : 'light'}
                isLoading={isLoading}
                isDisabled={isDisabled}
                onPress={handleToggle} // Direct call
                radius='full'
                color='default'
                startContent={isLoading ? null : <PiClockClockwiseDuotone size={32} />}
            >
                {`${hasSubs ? '关闭' : '开启'}每日复习提醒`}
            </Button>
            <Select
                size='sm'
                selectedKeys={[selectedHour.toString()]}
                onSelectionChange={(e) => setSelectedHour(parseInt(e.currentKey ?? '22'))}
                className='w-28'
                startContent='于'
                endContent={<span className='text-sm'>时</span>}
                isDisabled={hasSubs || isDisabled}
            >
                {new Array(24).fill(0).map((_, i) => (
                    <SelectItem key={i}>{i.toString()}</SelectItem>
                ))}
            </Select>
        </div>
    )
}

/** Skeleton placeholder while subscription status loads */
export function BellSkeleton() {
    return (
        <div className='flex gap-2 items-center justify-center'>
            <div className='h-10 w-48 animate-pulse rounded-full bg-default-100' />
            <div className='h-10 w-28 animate-pulse rounded-full bg-default-100' />
        </div>
    )
}
