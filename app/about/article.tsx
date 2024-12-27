'use client'

import { Card, CardBody } from '@nextui-org/react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { PiAppleLogoDuotone, PiBookOpenDuotone, PiSpeakerHifiDuotone, PiDeviceMobileDuotone } from 'react-icons/pi'
import { cn } from '@/lib/utils'
import { TypeAnimation } from 'react-type-animation'

export function TypedTitle() {
    return <TypeAnimation
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
}

export function Article() {
    return <article className='text-xl text-danger dark:text-danger-800'>
        <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            Leximory 是一个<span
                className='bg-danger-50/50 dark:bg-danger-900/20 px-1 rounded-md box-decoration-clone leading-[1.8]'
            >以大量阅读为宗</span>的语言学习平台。
        </motion.p>
        <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
        >
            我们相信，只有通过大量的阅读，才能<span
                className='bg-primary-50/50 dark:bg-primary-900/20 px-1 rounded-md box-decoration-clone leading-[1.8]'
            >真正习得词汇与文法</span>。
        </motion.p>
        <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
        >
            Leximory 为阅读提供必要辅助：<span
                className='bg-secondary-50/50 dark:bg-secondary-900/20 px-1 rounded-md box-decoration-clone leading-[1.8]'
            >智能注解</span>、<span
                className='bg-warning-50/50 dark:bg-warning-900/20 px-1 rounded-md box-decoration-clone leading-[1.8]'
            >生词记录</span>、<span
                className='bg-success-50/50 dark:bg-success-900/20 px-1 rounded-md box-decoration-clone leading-[1.8]'
            >复习提醒</span>等。
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
                transition={{ duration: 0.5, delay: 0.5 }}
                className='col-span-2'
            >
                <Link href='https://www.cdc.gov/niosh/mining/tools/installpwa.html'>
                    <GradientCard
                        title='边听边读'
                        text='语言认知的另一个维度'
                        gradient='bg-gradient-to-br from-danger-200 to-danger-300'
                    >
                        <PiDeviceMobileDuotone className='text-2xl opacity-60' />
                    </GradientCard>
                </Link>
            </motion.div>
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className='col-span-3'
            >
                <Link href='/blog/reading-while-listening'>
                    <GradientCard
                        title='PWA 支持'
                        text='享受原生应用体验：全屏访问、离线支持、桌面快捷方式……'
                        gradient='bg-gradient-to-br from-warning-200 to-warning-300'
                    >
                        <PiSpeakerHifiDuotone className='text-2xl opacity-60' />
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
        <iframe className='rounded-xl my-4' height={400} src='//player.bilibili.com/player.html?isOutside=true&aid=113248456147712&bvid=BV15V4FeEEqt&cid=26137266223&p=1' width={'100%'}></iframe>
    </article>
}


const GradientCard = ({ text, gradient, title, children }: {
    title: string,
    text: string,
    gradient: string,
    children?: React.ReactNode
}) => {
    return (
        <Card isPressable onPress={(e) => {
            e.continuePropagation()
        }} shadow='none' className={cn(gradient, 'p-3 min-h-36 h-full w-full relative rounded-lg')}>
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
