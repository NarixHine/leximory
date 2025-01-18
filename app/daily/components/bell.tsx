'use client'

import { Button } from "@heroui/button"
import { PiClockClockwiseDuotone } from 'react-icons/pi'
import { toast } from 'sonner'
import env from '@/lib/env'
import { save, remove } from '../actions'
import { useTransition } from 'react'
import { PushSubscription } from 'web-push'
import { useState } from 'react'
import { Select, SelectItem } from "@heroui/select"

export default function Bell({ hasSubs, hour = 22 }: {
    hasSubs: boolean
    hour?: number
}) {
    const [isUpdating, startUpdating] = useTransition()
    const [selectedHour, setSelectedHour] = useState(hour)

    const subscribe = async () => {
        const register = await navigator.serviceWorker.register('/sw.js')

        const subscription = await register.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        })

        await save({ subs: subscription as unknown as PushSubscription, hour: selectedHour })
    }

    return (
        <div className='flex flex-col justify-center items-center space-y-3'>
            <div className='flex gap-2 items-center'>
                <Button
                    variant={hasSubs ? 'flat' : 'ghost'}
                    isLoading={isUpdating}
                    onPress={() => {
                        startUpdating(async () => {
                            if (hasSubs) {
                                await remove()
                            } else {
                                try {
                                    await subscribe()
                                } catch {
                                    toast.error('开启失败，iOS 用户请将 Leximory 添加至主界面')
                                }
                            }
                        })
                    }}
                    size='lg'
                    radius='full'
                    color='primary'
                    startContent={isUpdating ? null : <PiClockClockwiseDuotone size={32} />}
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
                    isDisabled={!hasSubs}
                >
                    {new Array(24).fill(0).map((_, i) => (
                        <SelectItem key={i} value={i.toString()}>{i.toString()}</SelectItem>
                    ))}
                </Select>
            </div>
            <div className='opacity-50 text-sm text-balance text-center'>
                更换设备后需要重新开启
            </div>
        </div>
    )
}
