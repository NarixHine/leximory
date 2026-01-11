'use client'

import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/dropdown'
import { prefixUrl } from '@repo/env/config'
import { createClient } from '@repo/supabase/client'
import { useRouter } from 'next/navigation'
import { PiSignIn, PiSignOut } from 'react-icons/pi'

export function AvatarDropdown({ trigger, isLoggedIn }: { trigger: React.ReactNode, isLoggedIn: boolean }) {
    const router = useRouter()
    const handleLogin = () => {
        window.location.href = prefixUrl('/satellite?next=' + encodeURIComponent(window.location.pathname))
    }
    const handleLogout = () => {
        const supabase = createClient()
        supabase.auth.signOut().then(() => {
            console.log('User logged out')
            router.refresh()
        })
    }
    return (
        <Dropdown>
            <DropdownTrigger>
                {trigger}
            </DropdownTrigger>
            <DropdownMenu aria-label='User Menu'>
                {
                    isLoggedIn
                        ? <DropdownItem key='logout' startContent={<PiSignOut />} onPress={handleLogout}>登出 Leximory 账户</DropdownItem>
                        : <DropdownItem key='login' startContent={<PiSignIn />} onPress={handleLogin}>通过 Leximory 登录</DropdownItem>
                }
            </DropdownMenu>
        </Dropdown>
    )
}
