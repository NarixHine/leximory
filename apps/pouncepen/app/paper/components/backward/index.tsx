'use client'

import { Button } from '@heroui/button'
import { SkipBackCircleIcon } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'

export function Backward() {
    const router = useRouter()
    return (
        <div className='sticky top-4 -mt-4 px-4 h-0'>
            <Button
                variant='flat'
                radius='full'
                size='lg'
                onPress={() => router.push('/paper')}
                isIconOnly
                aria-label='Go Back'
                startContent={<SkipBackCircleIcon weight='duotone' size={20} />}
            />
        </div>
    )
}
