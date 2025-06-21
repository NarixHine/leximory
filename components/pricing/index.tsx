'use client'

import { Card, CardBody } from '@heroui/card'
import H from '../ui/h'
import { PiCheck } from 'react-icons/pi'
import { Divider } from '@heroui/divider'
import { Button } from '@heroui/button'
import { cn } from '@/lib/utils'
import { upgrade } from './actions'

export default function Pricing({ hideUpgradeButton }: { hideUpgradeButton?: boolean }) {
    return <div className="p-4 flex items-center justify-center">
        <div className="max-w-6xl w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                                <span>Talk to Your Library</span>
                                <span className="text-default-500 text-sm">自动化复盘：对话 AI，玩转词汇</span>
                            </div>
                        </div>
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

                    {!hideUpgradeButton && <Button
                        color="primary"
                        className="w-full"
                        variant="flat"
                        onPress={() => upgrade({ plan: 'bilingual' })}
                    >
                        开始体验
                    </Button>}
                </CardBody>
            </Card>

            {/* Polyglot Plan */}
            <Card className="p-4">
                <CardBody className="gap-4 flex flex-col">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1 justify-between">
                            <H usePlayfair disableCenter className="text-2xl">Polyglot 语言学人</H>
                            <span className={cn("text-primary-500 text-xs bg-primary-50 px-2 py-1 rounded-full")}>推荐</span>
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
                                <span>Talk to Your Library</span>
                                <span className="text-default-500 text-sm">自动化复盘：对话 AI，玩转词汇</span>
                            </div>
                        </div>
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
                    </div>

                    <div className='flex-1' />

                    {!hideUpgradeButton && <Button
                        color="primary"
                        className="w-full"
                        onPress={() => upgrade({ plan: 'polyglot' })}
                    >
                        立即升级
                    </Button>}
                </CardBody>
            </Card>
        </div>
    </div>
}
