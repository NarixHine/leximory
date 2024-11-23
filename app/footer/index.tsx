'use client'

import { Button, Chip, Popover, PopoverContent, PopoverTrigger } from '@nextui-org/react'
import Link from 'next/link'
import Image from 'next/image'
import DefineImg from './define.png'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { PiMailboxDuotone, PiTelevisionDuotone, PiGithubLogoDuotone, PiAppleLogoDuotone } from 'react-icons/pi'
import { cn, stringToColor } from '@/lib/utils'
import { useAtomValue } from 'jotai'
import { isReaderModeAtom } from '@/app/atoms'

const Footer = () => {
    const isReaderMode = useAtomValue(isReaderModeAtom)
    return (
        <footer className='text-center opacity-70 mb-3 mt-5'>
            {isReaderMode && <p>Generated on <span className='font-mono'>Leximory.com</span></p>}
            {!isReaderMode && <div className={cn('mx-auto w-full max-w-72 space-y-1', CHINESE_ZCOOL.className)}>
                <div className='flex w-full space-x-1'>
                    <Button size='sm' variant='solid' radius='sm' href='/blog' as={Link} className='h-5 bg-warning-200 text-warning-800 basis-1/3'>博客</Button>
                    <Popover shadow='sm'>
                        <PopoverTrigger>
                            <Button size='sm' variant='solid' radius='sm' className='h-5 bg-danger-200 text-danger-800 basis-2/3'>优质外刊资源</Button>
                        </PopoverTrigger>
                        <PopoverContent className='w-96'>
                            <Newspapers />
                        </PopoverContent>
                    </Popover>
                </div>
                <div className='flex w-full space-x-1'>
                    <Button size='sm' variant='solid' radius='sm' href='https://www.bilibili.com/video/BV15V4FeEEqt/' target='_blank' as={Link} className='h-5 bg-primary-200 text-primary-800 basis-2/3'>功能演示</Button>
                    <Popover shadow='sm'>
                        <PopoverTrigger>
                            <Button size='sm' variant='solid' radius='sm' className='h-5 bg-secondary-300 text-secondary-900 basis-1/3'>选中查询</Button>
                        </PopoverTrigger>
                        <PopoverContent className='p-3'>
                            <p className={cn('mb-1.5 text-balance text-center', CHINESE_ZCOOL.className)}>
                                选中点击即可对任意词汇生成 AI 注解，<br></br>
                                含语境义、发音、词源（英文文库）。<br></br>
                                消耗 AI 注解生成次数：0.25 次。
                            </p>
                            <Image src={DefineImg} alt='Define' width={150} className='shadow rounded'></Image>
                        </PopoverContent>
                    </Popover>
                </div>
                <div className='flex mx-auto w-fit'>
                    <Button
                        size='sm'
                        variant='light'
                        radius='full'
                        href='https://space.bilibili.com/3494376432994441/'
                        isIconOnly
                        startContent={<PiTelevisionDuotone />}
                        as={Link}
                        className='text-lg text-danger-700'
                    ></Button>
                    <Button
                        size='sm'
                        variant='light'
                        radius='full'
                        href='https://github.com/narixhine/leximory'
                        isIconOnly
                        startContent={<PiGithubLogoDuotone />}
                        as={Link}
                        className='text-lg text-danger-700'
                    ></Button>
                    <Button
                        size='sm'
                        variant='light'
                        radius='full'
                        href='mailto:hi@leximory.com'
                        isIconOnly
                        startContent={<PiMailboxDuotone />}
                        as={Link}
                        className='text-lg text-danger-700'
                    ></Button>
                     <Button
                        size='sm'
                        variant='light'
                        radius='full'
                        href='/blog/ios-shortcuts'
                        isIconOnly
                        startContent={<PiAppleLogoDuotone />}
                        as={Link}
                        className='text-lg text-danger-700'
                    ></Button>
                </div>
            </div>}
        </footer>
    )
}

function Newspapers() {
    const newspapers = [
        { name: 'The Atlantic', url: 'https://www.theatlantic.com/' },
        { name: 'The Economist', url: 'https://www.economist.com/' },
        { name: 'The Financial Times', url: 'https://www.ft.com/' },
        { name: 'The Guardian (free)', url: 'https://www.theguardian.com/' },
        { name: 'The New York Times', url: 'https://www.nytimes.com/' },
        { name: 'The New Yorker', url: 'https://www.newyorker.com/' },
        { name: 'The Verge (free)', url: 'https://www.theverge.com/' },
        { name: 'The Wall Street Journal', url: 'https://www.wsj.com/' },
        { name: 'The Washington Post', url: 'https://www.washingtonpost.com/' },
    ]

    return (
        <div className='mx-auto py-3'>
            <div className='flex flex-wrap justify-center gap-2'>
                {newspapers.map(({ name, url }) => (
                    <Chip
                        key={name}
                        as={Link}
                        href={url}
                        size='sm'
                        color={stringToColor(name)}
                        className='cursor-pointer'
                        variant='flat'
                        target='_blank'
                    >
                        {name}
                    </Chip>
                ))}
            </div>
        </div>
    )
}

export default Footer
