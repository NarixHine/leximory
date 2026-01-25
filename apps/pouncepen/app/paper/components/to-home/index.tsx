'use client'

import { Button } from '@heroui/button'
import { FolderIcon } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'

export function ToHome() {
    const router = useRouter()
    return (
        <div className='sticky top-4 -mt-4 px-4 h-0'>
            <Button
                variant='flat'
                radius='full'
                size='lg'
                onPress={() => router.push('/paper')}
                isIconOnly
                aria-label='Go Home'
                startContent={<FolderIcon weight='duotone' size={24} />}
            />
        </div>
    )
}
