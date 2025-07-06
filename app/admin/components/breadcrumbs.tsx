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
    
    // Add specific breadcrumbs based on path
    if (pathname.startsWith('/admin/times')) {
        breadcrumbItems.push({
            key: 'times',
            href: '/admin/times',
            title: 'Times',
            icon: <PiNewspaperDuotone className='w-4 h-4' />
        })
        
        // Check if we're on a specific date page
        const dateMatch = pathname.match(/\/admin\/times\/(\d{4}-\d{2}-\d{2})/)
        if (dateMatch) {
            breadcrumbItems.push({
                key: 'edit',
                href: pathname,
                title: `Edit ${dateMatch[1]}`,
                icon: null
            })
        }
    }
    
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
