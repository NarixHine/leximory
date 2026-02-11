'use client'

import Hero from '@/components/ui/hero'
import { Button } from '@heroui/button'
import { SignInIcon } from '@phosphor-icons/react/ssr'
import { prefixPathname } from '@repo/env/config'
import Link from 'next/link'

export default function Unauthorized() {
    return (
        <Hero title='401' description='需要登录'>
            <Button
                endContent={<SignInIcon weight='fill' size={20} />}
                color='primary'
                size='sm'
                as={Link}
                href={prefixPathname({ path: '/satellite' })}
            >
                登录
            </Button>
        </Hero>
    )
}
