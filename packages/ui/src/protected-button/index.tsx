'use client'

import { Button, type ButtonProps } from '@heroui/button'
import { Dropdown, DropdownMenu, DropdownItem, DropdownTrigger } from '@heroui/dropdown'
import { useUser } from '../auth'
import { prefixPathname } from '@repo/env/config'
import { PiSignIn } from 'react-icons/pi'
import Link from 'next/link'
import ShinyText from '../shiny-text'
import { useDarkMode } from 'usehooks-ts'

export function ProtectedButton(props: ButtonProps) {
    const { isLoggedIn, isLoading } = useUser()
    const { isDarkMode } = useDarkMode()

    if (isLoading) {
        return <Button {...props} isLoading />
    }

    if (isLoggedIn) {
        return <Button {...props} />
    }

    return (
        <Dropdown>
            <DropdownTrigger>
                <Button {...props} onPress={undefined} />
            </DropdownTrigger>
            <DropdownMenu>
                <DropdownItem
                    key={'sign-in'}
                    startContent={<PiSignIn />}
                    as={Link}
                    href={prefixPathname({ path: '/satellite', next: window.location.href })}
                >
                    {isDarkMode ? (
                        <ShinyText color='#ffffff' shineColor='#666f87' text='请登录，因为这是一个厉害的功能' />
                    ) : (
                        <ShinyText color='#000000' shineColor='#ffffff' text='请登录，因为这是一个厉害的功能' />
                    )}
                </DropdownItem>
            </DropdownMenu>
        </Dropdown>
    )
}
