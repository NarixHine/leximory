'use client'

import { Button } from '@nextui-org/react'
import { useRouter } from 'next/navigation'
import { PiNewspaperDuotone } from 'react-icons/pi'

export default function DailyCard() {
    const router = useRouter()
    return <div className='w-full py-2 px-4 items-center flex bg-gradient-to-r from-primary-200 to-warning-200 rounded-lg'>
        <div className='font-bold opacity-50'>每日复盘</div>
        <div className='flex-1'></div>
        <div>
            <Button
                onPress={() => router.push('/daily')}
                variant={'light'}
                className='font-semibold'
                color={'primary'}
                startContent={<PiNewspaperDuotone />}
            >查看</Button>
        </div>
    </div>
}
