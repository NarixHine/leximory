'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PiSquaresFourDuotone, PiUsersThreeDuotone } from 'react-icons/pi'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
    { href: '/admin', label: 'Overview', icon: PiSquaresFourDuotone },
    { href: '/admin/users', label: 'Users', icon: PiUsersThreeDuotone },
] as const

export default function AdminNav() {
    const pathname = usePathname()

    return (
        <nav className='flex items-center gap-1 rounded-full bg-default-50 p-1 w-fit' aria-label='Admin'>
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const isActive = href === '/admin' ? pathname === href : pathname.startsWith(href)

                return (
                    <Link
                        key={href}
                        href={href}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                            'flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all duration-200',
                            'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus',
                            isActive
                                ? 'bg-background text-foreground shadow-xs'
                                : 'text-default-600 hover:text-foreground',
                        )}
                    >
                        <Icon className='size-4' />
                        {label}
                    </Link>
                )
            })}
        </nav>
    )
}
