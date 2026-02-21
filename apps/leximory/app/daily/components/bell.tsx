'use client'

import { Button } from "@heroui/button"
import { PiClockClockwiseDuotone } from 'react-icons/pi'
import { toast } from 'sonner'
import env from '@repo/env'
import { save, remove } from '../actions'
import { PushSubscription } from 'web-push'
import { useState } from 'react'
import { Select, SelectItem } from '@heroui/select'
import { isIos, urlB64ToUint8Array } from '@/lib/utils'

// Helper to ensure the SW is actually active before subscribing
const waitForServiceWorkerActive = (registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> => {
    return new Promise((resolve) => {
        if (registration.active) {
            return resolve(registration)
        }

        const sw = registration.installing || registration.waiting
        if (sw) {
            sw.addEventListener('statechange', (e) => {
                if ((e.target as ServiceWorker).state === 'activated') {
                    resolve(registration)
                }
            })
        }
    })
}

export const subscribe = async (hour: number) => {
    toast.info('检查浏览器支持中...')
    if (!('serviceWorker' in navigator)) {
        throw new Error('当前浏览器不支持，请使用 Chrome 或 Safari')
    }
    if (!('PushManager' in window) || !('Notification' in window)) {
        throw new Error(`当前浏览器不支持推送通知${isIos() ? '，iOS 用户请将 Leximory 添加至主界面' : ''}`)
    }

    toast.info('正在请求通知权限...')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
        throw new Error('未获得通知权限，请在系统设置中允许')
    }

    toast.info('正在注册服务工作线程...')
    // Register and then FORCIBLY wait for the 'active' state
    let registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })

    toast.info('正在等待服务工作线程激活...')
    registration = await waitForServiceWorkerActive(registration)

    const applicationServerKey = urlB64ToUint8Array(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)

    toast.info('正在订阅推送通知...')
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
    })

    toast.success('订阅成功！')
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
