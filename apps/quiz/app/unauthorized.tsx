import { Main } from '@repo/ui/main'
import { Button } from '@heroui/button'
import { SignInIcon } from '@phosphor-icons/react/ssr'
import { prefixPathname } from '@repo/env/config'
import Link from 'next/link'

export default function Unauthorized() {
    return (
        <Main className='flex flex-col items-center justify-center'>
            <h1 className='text-8xl font-bold text-foreground/20'>401</h1>
            <p className='text-lg text-foreground/60 mt-2'>需要登录</p>
            <Button
                endContent={<SignInIcon weight='fill' size={20} />}
                color='primary'
                size='sm'
                as={Link}
                href={prefixPathname({ path: '/satellite' })}
                className='mt-6'
            >
                登录
            </Button>
        </Main>
    )
}
