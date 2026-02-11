'use client'

import { Main } from '@repo/ui/main'
import { Button } from '@heroui/button'
import { SignInIcon, HouseIcon } from '@phosphor-icons/react/ssr'
import { prefixPathname } from '@repo/env/config'
import Link from 'next/link'
import { useUser } from '@repo/ui/auth'

export default function Unauthorized() {
    const { isLoggedIn } = useUser()
    return (
        <Main className='flex flex-col items-center justify-center'>
            <h1 className='sm:text-7xl text-5xl font-bold text-foreground/20'>Unauthorized.</h1>
            {isLoggedIn ? <Button
                endContent={<HouseIcon weight='fill' size={20} />}
                color='primary'
                as={Link}
                href={'/'}
                className='mt-3'
            >
                回到首页
            </Button> : <Button
                endContent={<SignInIcon weight='fill' size={20} />}
                color='primary'
                as={Link}
                href={prefixPathname({ path: '/satellite' })}
                className='mt-3'
            >
                登录
            </Button>}
        </Main>
    )
}
