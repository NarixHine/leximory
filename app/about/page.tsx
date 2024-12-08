import Main from '@/components/main'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { Button } from '@nextui-org/button'
import Link from 'next/link'
import { PiTelevisionDuotone, PiGithubLogoDuotone, PiMailboxDuotone, PiPenNibDuotone } from 'react-icons/pi'
import { Metadata } from 'next'
import { TypedTitle, Article } from './client'

export const metadata: Metadata = {
    title: 'How to Use Leximory'
}

export default function About() {
    return (
        <Main className={cn('max-w-screen-sm', CHINESE_ZCOOL.className)}>
            <h1 className={cn('text-danger dark:text-danger-800 text-4xl font-mono')}>
                <TypedTitle />
            </h1>
            <div className='flex w-fit mt-1 mb-6'>
                <Button
                    size='sm'
                    variant='light'
                    radius='full'
                    href='https://space.bilibili.com/3494376432994441/'
                    isIconOnly
                    startContent={<PiTelevisionDuotone />}
                    as={Link}
                    className='text-xl text-danger-700'
                ></Button>
                <Button
                    size='sm'
                    variant='light'
                    radius='full'
                    href='https://github.com/narixhine/leximory'
                    isIconOnly
                    startContent={<PiGithubLogoDuotone />}
                    as={Link}
                    className='text-xl text-danger-700'
                ></Button>
                <Button
                    size='sm'
                    variant='light'
                    radius='full'
                    href='mailto:hi@leximory.com'
                    isIconOnly
                    startContent={<PiMailboxDuotone />}
                    as={Link}
                    className='text-xl text-danger-700'
                ></Button>
                <Button
                    size='sm'
                    variant='light'
                    radius='full'
                    href='/blog'
                    isIconOnly
                    startContent={<PiPenNibDuotone />}
                    as={Link}
                    className='text-xl text-danger-700'
                ></Button>
            </div>
            <Article />
        </Main>
    )
}
