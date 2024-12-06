'use client'

import Main from '@/components/main'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { Button, Card, CardBody } from '@nextui-org/react'
import Link from 'next/link'
import { PiTelevisionDuotone, PiGithubLogoDuotone, PiMailboxDuotone, PiAppleLogoDuotone, PiDeviceMobileDuotone, PiSpeakerHifiDuotone, PiBookOpenDuotone, PiPenNibDuotone } from 'react-icons/pi'
import { motion } from 'framer-motion'
import { TypeAnimation } from 'react-type-animation'

export default function About() {
    return (
        <Main className={cn('max-w-screen-sm', CHINESE_ZCOOL.className)}>
            <h1 className={cn('text-danger dark:text-danger-800 mt-12 text-5xl font-mono')}>
                <TypeAnimation
                    sequence={[
                        'About Us',
                        500,
                        'How to Use Leximory',
                        1000,
                    ]}
                    speed={50}
                    cursor={true}
                    repeat={0}
                    preRenderFirstString={true}
                />
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
            <article className={cn('text-xl text-danger dark:text-danger-800')}>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    Leximory 是一个<motion.mark
                        className='bg-danger-50/50 dark:bg-danger-900/20 px-1 rounded-md box-decoration-clone leading-[1.8]'
                        whileHover={{ scale: 1.05 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                    >以大量阅读为宗</motion.mark>的语言学习平台。
                </motion.p>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    我们相信，只有通过大量的阅读，才能<motion.mark
                        className='bg-primary-50/50 dark:bg-primary-900/20 px-1 rounded-md box-decoration-clone leading-[1.8]'
                        whileHover={{ scale: 1.05 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                    >真正习得词汇与文法</motion.mark>。
                </motion.p>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                >
                    Leximory 为阅读提供必要辅助：<motion.mark
                        className='bg-secondary-50/50 dark:bg-secondary-900/20 px-1 rounded-md box-decoration-clone leading-[1.8]'
                        whileHover={{ scale: 1.05 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                    >智能注解</motion.mark>、<motion.mark
                        className='bg-warning-50/50 dark:bg-warning-900/20 px-1 rounded-md box-decoration-clone leading-[1.8]'
                        whileHover={{ scale: 1.05 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                    >生词记录</motion.mark>、<motion.mark
                        className='bg-success-50/50 dark:bg-success-900/20 px-1 rounded-md box-decoration-clone leading-[1.8]'
                        whileHover={{ scale: 1.05 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                    >复习提醒</motion.mark>等。
                </motion.p>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    className='mt-8 mb-4'
                >
                    一些隐藏功能：
                </motion.p>

                <div className='grid grid-cols-5 gap-4 mb-10'>
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className='col-span-2'
                    >
                        <Link href='/blog/ios-shortcuts'>
                            <GradientCard
                                title='iOS Shortcut'
                                text='在苹果设备上快速保存单词'
                                gradient='bg-gradient-to-br from-primary-200 to-primary-300'
                            >
                                <PiAppleLogoDuotone className='text-2xl opacity-60' />
                            </GradientCard>
                        </Link>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className='col-span-3'
                    >
                        <GradientCard
                            title='导入电子书'
                            text='能注解文章，还能边读书边注解'
                            gradient='bg-gradient-to-br from-secondary-200 to-secondary-300'
                        >
                            <PiBookOpenDuotone className='text-2xl opacity-60' />
                        </GradientCard>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className='col-span-3'
                    >
                        <Link href='/blog/reading-while-listening'>
                            <GradientCard
                                title='边听边读'
                                text='听觉是语言认知的另一个维度，与视觉相辅相成'
                                gradient='bg-gradient-to-br from-warning-200 to-warning-300'
                            >
                                <PiSpeakerHifiDuotone className='text-2xl opacity-60' />
                            </GradientCard>
                        </Link>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                        className='col-span-2'
                    >
                        <Link href='https://www.cdc.gov/niosh/mining/tools/installpwa.html'>
                            <GradientCard
                                title='PWA 支持'
                                text='下载到主屏幕后离线访问与阅读'
                                gradient='bg-gradient-to-br from-danger-200 to-danger-300'
                            >
                                <PiDeviceMobileDuotone className='text-2xl opacity-60' />
                            </GradientCard>
                        </Link>
                    </motion.div>
                </div>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                >
                    核心功能的演示视频：
                </motion.p>
                <iframe className='rounded my-4' height={400} src='//player.bilibili.com/player.html?isOutside=true&aid=113248456147712&bvid=BV15V4FeEEqt&cid=26137266223&p=1' width={'100%'}></iframe>
            </article>
        </Main >
    )
}

const GradientCard = ({ text, gradient, title, children }: {
    title: string,
    text: string,
    gradient: string,
    children?: JSX.Element
}) => {
    return (
        <Card isPressable shadow='none' className={cn(gradient, 'p-3 min-h-36 h-full w-full relative rounded-lg')}>
            <CardBody className='overflow-hidden'>
                <h2 className='text-xl'>{title}</h2>
                <p className='opacity-60 text-lg'>{text}</p>
                <div className='absolute -bottom-3 -right-3 p-3'>
                    {children}
                </div>
            </CardBody>
        </Card>
    )
}
