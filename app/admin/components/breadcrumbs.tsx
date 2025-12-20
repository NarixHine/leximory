'use client'

import { Breadcrumbs, BreadcrumbItem } from '@heroui/breadcrumbs'
import { usePathname } from 'next/navigation'
import { PiHouseDuotone, PiNewspaperDuotone } from 'react-icons/pi'

export default function AdminBreadcrumbs() {
    const pathname = usePathname()
    
    const breadcrumbItems = []
    
    // Always add admin root
    breadcrumbItems.push({
        key: 'admin',
        href: '/admin',
        title: 'Admin',
        icon: <PiHouseDuotone className='w-4 h-4' />
    })
    
    return (
        <Breadcrumbs className='mb-4'>
            {breadcrumbItems.map((item) => (
                <BreadcrumbItem
                    key={item.key}
                    href={item.href}
                    startContent={item.icon}
                >
                    {item.title}
                </BreadcrumbItem>
            ))}
        </Breadcrumbs>
    )
}
