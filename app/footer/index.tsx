'use client'

import { Button } from '@nextui-org/button'
import Link from 'next/link'
import { Popover, PopoverContent, PopoverTrigger } from '@nextui-org/popover'
import Image from 'next/image'
import DefineImg from './define.png'
import { xw } from '@/lib/fonts'
import { PiMailboxDuotone, PiTelevisionDuotone, PiGithubLogoDuotone } from 'react-icons/pi'
import { cn } from '@/lib/utils'
import { useAtomValue } from 'jotai'
import { isReaderModeAtom } from '@/app/atoms'

const Footer = () => {
    const isReaderMode = useAtomValue(isReaderModeAtom)
    return (
        <footer className='text-center opacity-70 mb-3 mt-5'>
            {isReaderMode && <p>Generated on <span className='font-mono'>Leximory.com</span></p>}
            {!isReaderMode && <div className={cn('mx-auto w-full max-w-72 space-y-1', xw.className)}>
                <div className='flex w-full space-x-1'>
                    <Button size='sm' variant='solid' radius='sm' href='/blog/from-memorisation-to-acquisition' as={Link} className='h-5 bg-danger-200 text-danger-800 basis-3/4'>从记忆到心会</Button>
                    <Button size='sm' variant='solid' radius='sm' href='/blog' as={Link} className='h-5 bg-warning-200 text-warning-800 basis-1/4'>博客</Button>
                </div>
                <div className='flex w-full space-x-1'>
                    <Button size='sm' variant='solid' radius='sm' href='/blog/reading-while-listening' as={Link} className='h-5 bg-primary-200 text-primary-800 basis-1/2'>边听边读</Button>
                    <Popover>
                        <PopoverTrigger>
                            <Button size='sm' variant='solid' radius='sm' className='h-5 bg-secondary-300 text-secondary-900 basis-1/2'>选中查询</Button>
                        </PopoverTrigger>
                        <PopoverContent className='p-3'>
                            <p className={cn('mb-1.5 text-balance text-center', xw.className)}>
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
                </div>
            </div>}
        </footer>
    )
}

export default Footer
