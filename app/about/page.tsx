import Main from '@/components/ui/main'
import { CHINESE_ZCOOL, ENGLISH_PLAYFAIR } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { Button } from "@heroui/button"
import Link from 'next/link'
import { PiTelevisionDuotone, PiGithubLogoDuotone, PiMailboxDuotone, PiPenNibDuotone } from 'react-icons/pi'
import { Metadata } from 'next'
import { TypedTitle, Article } from './article'
import { bilibiliLink } from '@/lib/config'
import Pricing from '@/components/pricing'
import H from '@/components/ui/h'

export const metadata: Metadata = {
    title: 'How to Use Leximory'
}

export default function About() {
    return (
        <Main className={cn(CHINESE_ZCOOL.className, 'max-w-7xl')}>
            <section className='max-w-screen-sm mx-auto'>
                <h1 className={cn('text-4xl', ENGLISH_PLAYFAIR.className)}>
                    <TypedTitle />
                </h1 >
                <div className='flex w-fit mt-1 mb-6'>
                    <Button
                        size='sm'
                        variant='light'
                        radius='full'
                        href={bilibiliLink}
                        isIconOnly
                        startContent={<PiTelevisionDuotone />}
                        as={Link}
                        className='text-xl text-pink-400'
                    ></Button>
                    <Button
                        size='sm'
                        variant='light'
                        radius='full'
                        href='https://github.com/narixhine/leximory'
                        isIconOnly
                        startContent={<PiGithubLogoDuotone />}
                        as={Link}
                        className='text-xl opacity-50'
                    ></Button>
                    <Button
                        size='sm'
                        variant='light'
                        radius='full'
                        href='mailto:hi@leximory.com'
                        isIconOnly
                        startContent={<PiMailboxDuotone />}
                        as={Link}
                        className='text-xl opacity-50'
                    ></Button>
                    <Button
                        size='sm'
                        variant='light'
                        radius='full'
                        href='/blog'
                        isIconOnly
                        startContent={<PiPenNibDuotone />}
                        as={Link}
                        className='text-xl opacity-50'
                    ></Button>
                </div>
                <Article />
            </section>
            <section className='max-w-7xl mx-auto mt-5'>
                <H usePlayfair disableCenter className='text-2xl pl-4'>订价</H>
                <Pricing hideUpgradeButton />
            </section>
        </Main >
    )
}
