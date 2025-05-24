'use client'

import { Card, CardBody } from "@heroui/card"
import { motion } from 'framer-motion'
import { PiAppleLogoDuotone, PiBookOpenDuotone, PiSpeakerHifiDuotone, PiDeviceMobileDuotone } from 'react-icons/pi'
import { cn } from '@/lib/utils'
import { TypeAnimation } from 'react-type-animation'
import { useRouter } from 'next/navigation'
import { Spacer } from "@heroui/spacer"
import { exampleEbookLink } from '@/lib/config'
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/react'
import Link from 'next/link'

export function TypedTitle() {
    return <TypeAnimation
        sequence={[
            'About Us',
            2000,
            'How to Use Leximory',
        ]}
        speed={50}
        cursor={true}
        repeat={0}
        preRenderFirstString={true}
    />
}

export function Article() {
    return <article className='text-xl'>
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
            科学研究表明，只有通过大量的阅读，才能<span
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
                    className='bg-gradient-to-br from-primary-50/50 to-secondary-100/50'
                    to={exampleEbookLink}
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
                <GradientCard
                    title='iOS Shortcuts'
                    text='在苹果设备上快速保存单词'
                    to='/blog/ios-shortcuts'
                    className='bg-gradient-to-bl from-warning-50/50 to-secondary-100/50'
                >
                    <PiAppleLogoDuotone className='text-2xl opacity-60' />
                </GradientCard>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className='col-span-2'
            >
                <GradientCard
                    to='/blog/reading-while-listening'
                    title='边听边读'
                    text='语言认知的另一个维度'
                    className='bg-gradient-to-tr from-warning-50/50 to-danger-100/50'
                >
                    <PiDeviceMobileDuotone className='text-2xl opacity-60' />
                </GradientCard>
            </motion.div>
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className='col-span-3'
            >
                <GradientCard
                    title='PWA 支持'
                    text='享受原生应用体验：全屏访问、离线支持、桌面快捷方式……'
                    to='/blog/install-pwa'
                    className='bg-gradient-to-tl from-primary-50/50 to-warning-100/50'
                >
                    <PiSpeakerHifiDuotone className='text-2xl opacity-60' />
                </GradientCard>
            </motion.div>
        </div>

        <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
        >
            核心功能的演示视频：
        </motion.p>
        <iframe className='rounded-xl my-4 md:h-[360px] sm:h-[320px] h-[280px]' src='//player.bilibili.com/player.html?isOutside=true&aid=114210461845887&bvid=BV1m1X8YuEDg&cid=29024977489&p=1&muted=true' width={'100%'} allowFullScreen></iframe>

        <Spacer y={10}></Spacer>
        <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className='text-2xl'
        >
            附录
        </motion.h2>
        <Spacer y={2}></Spacer>
        <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1 }}
        >
            各项操作所消耗的每月 AI 配额：
        </motion.p>
        <Spacer y={4}></Spacer>
        <Table>
            <TableHeader>
                <TableColumn className='font-medium'>操作</TableColumn>
                <TableColumn className='font-medium'>消耗 AI 注解次数</TableColumn>
                <TableColumn className='font-medium'>描述</TableColumn>
            </TableHeader>
            <TableBody>
                <TableRow key='article-annotation'>
                    <TableCell>文章注解</TableCell>
                    <TableCell>1</TableCell>
                    <TableCell>对一篇文本的全文进行生词注解</TableCell>
                </TableRow>
                <TableRow key='word-annotation'>
                    <TableCell>词汇动态注解</TableCell>
                    <TableCell>0.20</TableCell>
                    <TableCell>根据语境对选中词汇进行动态注解</TableCell>
                </TableRow>
                <TableRow key='ebook-word-annotation'>
                    <TableCell>书籍动态注解</TableCell>
                    <TableCell>0.20</TableCell>
                    <TableCell>对电子书内选中词汇根据语境注解</TableCell>
                </TableRow>
                <TableRow key='word-list'>
                    <TableCell>提取词汇</TableCell>
                    <TableCell>1</TableCell>
                    <TableCell>提取图像中的外语词汇供连词成文使用</TableCell>
                </TableRow>
                <TableRow key='story'>
                    <TableCell>连词成文</TableCell>
                    <TableCell>2</TableCell>
                    <TableCell>在语料本或文本页面将词汇串联成文</TableCell>
                </TableRow>
                <TableRow key='fix-your-paper'>
                    <TableCell><Link href='/fix-your-paper' className='underline underline-offset-2'>Fix. Your. Paper.</Link></TableCell>
                    <TableCell>5</TableCell>
                    <TableCell>（面向出题人）审阅高考规格英语试卷</TableCell>
                </TableRow>
            </TableBody>
        </Table>
    </article>
}

const GradientCard = ({ text, className, title, children, to }: {
    title: string,
    text: string,
    className: string,
    children?: React.ReactNode
    to: string
}) => {
    const router = useRouter()
    return (
        <Card isPressable onPress={() => {
            router.push(to)
        }} shadow='none' className={cn(className, 'p-3 min-h-36 h-full w-full relative rounded-lg')}>
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
