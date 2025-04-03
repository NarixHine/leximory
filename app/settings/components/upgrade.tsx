'use client'

import { Button } from '@heroui/button'
import { PiCheck, PiRocketLaunchDuotone, PiQuestion } from 'react-icons/pi'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { Drawer, DrawerBody, DrawerContent } from '@heroui/drawer'
import { useDisclosure } from '@heroui/modal'
import { Card, CardBody } from '@heroui/card'
import { Divider } from '@heroui/divider'
import { manageSubscription, upgrade } from '../actions'
import H from '@/components/ui/h'
import Link from 'next/link'
import { bilibiliLink } from '@/lib/config'

export default function Upgrade({ isOnFreeTier }: { isOnFreeTier: boolean }) {
    const { isOpen, onOpen, onClose } = useDisclosure()
    return <>
        <Button onPress={() => isOnFreeTier ? onOpen() : manageSubscription()} variant='solid' startContent={<PiRocketLaunchDuotone />} size='lg' color='primary' radius='full' className={cn(CHINESE_ZCOOL.className,)}>{isOnFreeTier ? '升级' : '管理订阅'}</Button>
        <Drawer isOpen={isOpen} onOpenChange={onOpen} onClose={onClose} placement='bottom'>
            <DrawerContent className='bg-background max-h-[90vh] sm:max-h-[80vh] md:max-h-[75vh] overflow-y-auto'>
                {() => (
                    <DrawerBody>
                        <div className="p-4 flex items-center justify-center">
                            <div className="max-w-5xl w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {/* Free Plan */}
                                <Card className="p-4">
                                    <CardBody className="gap-4">
                                        <div className="flex flex-col gap-2">
                                            <H usePlayfair disableCenter className="text-2xl">Beginner 初学者</H>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-xl font-semibold">US$0.00</span>
                                                <span className="text-default-500 text-sm">/月</span>
                                            </div>
                                        </div>

                                        <Divider />

                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-start gap-2">
                                                <PiCheck className="text-success-500 w-4 h-4 mt-1" />
                                                <div className="flex flex-col">
                                                    <span>20 次文章注解</span>
                                                    <span className="text-default-500 text-sm">相当于 80 次词汇注解</span>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <PiCheck className="text-success-500 w-4 h-4 mt-1" />
                                                <div className="flex flex-col">
                                                    <span>3 次朗读生成</span>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <PiCheck className="text-success-500 w-4 h-4 mt-1" />
                                                <div className="flex flex-col">
                                                    <span>每日 LexiCoin</span>
                                                    <span className="text-default-500 text-sm">可领取 1 个代币</span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardBody>
                                </Card>

                                {/* Bilingual Plan */}
                                <Card className="p-4">
                                    <CardBody className="gap-4 flex flex-col">
                                        <div className="flex flex-col gap-2">
                                            <H usePlayfair disableCenter className="text-2xl">Bilingual 双语者</H>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-xl font-semibold">US$4.49</span>
                                                <span className="text-default-500 text-sm">/月（≈32元）</span>
                                            </div>
                                        </div>

                                        <Divider />

                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-start gap-2">
                                                <PiCheck className="text-success-500 w-4 h-4 mt-1" />
                                                <div className="flex flex-col">
                                                    <span>100 次文章注解</span>
                                                    <span className="text-default-500 text-sm">相当于 400 次词汇注解</span>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <PiCheck className="text-success-500 w-4 h-4 mt-1" />
                                                <div className="flex flex-col">
                                                    <span>10 次朗读生成</span>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <PiCheck className="text-success-500 w-4 h-4 mt-1" />
                                                <div className="flex flex-col">
                                                    <span>每日 LexiCoin</span>
                                                    <span className="text-default-500 text-sm">可领取 3 个代币</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className='flex-1' />

                                        <Button
                                            color="primary"
                                            className="w-full"
                                            variant="flat"
                                            onPress={() => upgrade({ plan: 'bilingual' })}
                                        >
                                            开始体验
                                        </Button>
                                    </CardBody>
                                </Card>

                                {/* Polyglot Plan */}
                                <Card className="p-4">
                                    <CardBody className="gap-4 flex flex-col">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-1 justify-between">
                                                <H usePlayfair disableCenter className="text-2xl">Polyglot 语言学人</H>
                                                <span className={cn("text-primary-500 text-xs bg-primary-50 px-2 py-1 rounded-full", CHINESE_ZCOOL.className)}>推荐</span>
                                            </div>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-xl font-semibold">US$6.00</span>
                                                <span className="text-default-500 text-sm">/月（≈43元）</span>
                                            </div>
                                        </div>

                                        <Divider />

                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-start gap-2">
                                                <PiCheck className="text-success-500 w-4 h-4 mt-1" />
                                                <div className="flex flex-col">
                                                    <span>200 次文章注解</span>
                                                    <span className="text-default-500 text-sm">相当于 800 次词汇注解</span>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <PiCheck className="text-success-500 w-4 h-4 mt-1" />
                                                <div className="flex flex-col">
                                                    <span>20 次朗读生成</span>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <PiCheck className="text-success-500 w-4 h-4 mt-1" />
                                                <div className="flex flex-col">
                                                    <span>每日 LexiCoin</span>
                                                    <span className="text-default-500 text-sm">可领取 10 个代币</span>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <PiCheck className="text-success-500 w-4 h-4 mt-1" />
                                                <div className="flex flex-col">
                                                    <span>学习小组功能</span>
                                                    <span className="text-default-500 text-sm">创建并管理学习社群</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className='flex-1' />

                                        <Button
                                            color="primary"
                                            className="w-full"
                                            onPress={() => upgrade({ plan: 'polyglot' })}
                                        >
                                            立即升级
                                        </Button>
                                    </CardBody>
                                </Card>
                            </div>
                        </div>
                        <p className='text-default-500 text-sm text-center pb-4'>
                            <PiQuestion className='inline-block' />遇到问题？<Link href={bilibiliLink} className='underline underline-offset-4'>在 B 站上</Link>联系我们，或发邮件到<Link href='mailto:hi@leximory.com' className='underline underline-offset-4'>hi@leximory.com</Link>
                        </p>
                    </DrawerBody>
                )}
            </DrawerContent>
        </Drawer>
    </>
}
