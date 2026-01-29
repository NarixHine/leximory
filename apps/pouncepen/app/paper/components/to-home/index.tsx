'use client'

import { Button } from '@heroui/button'
import { FolderIcon } from '@phosphor-icons/react'
import { NavIndicator } from '@repo/ui/nav-indicator'
import Link from 'next/link'

export function ToHome() {
    return (
        <div className='sticky top-3 -mt-3 pl-3 h-0 backdrop-blur-lg z-100'>
            <Button
                variant='flat'
                radius='full'
                size='lg'
                as={Link}
                href='/paper'
                isIconOnly
                aria-label='Go Home'
                startContent={<NavIndicator icon={<FolderIcon weight='duotone' size={24} />} />}
            />
        </div>
    )
}
