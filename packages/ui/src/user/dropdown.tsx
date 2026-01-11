'use client'

import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/dropdown'
import { PiSignIn } from 'react-icons/pi'

export function AvatarDropdown({ trigger }: { trigger: React.ReactNode }) {
    return (
        <Dropdown>
            <DropdownTrigger>
                {trigger}
            </DropdownTrigger>
            <DropdownMenu aria-label='User Menu'>
               <DropdownItem key='login' startContent={<PiSignIn />}>通过 Leximory 登录</DropdownItem>
            </DropdownMenu>
        </Dropdown>
    )
}
