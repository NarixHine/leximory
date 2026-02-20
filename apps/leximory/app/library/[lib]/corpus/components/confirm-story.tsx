'use client'

import Markdown from '@/components/markdown'
import { Button } from '@heroui/button'
import { Card, CardBody, CardFooter, CardHeader } from '@heroui/card'
import { createCallable } from 'react-call'
import { PiMagicWandDuotone } from 'react-icons/pi'

type Response = boolean

export const ConfirmStory = createCallable<{ comments: string[] }, Response>(({ call, comments }) => (
    <Card role='dialog' className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 p-6 max-w-md shadow-lg'>
        <CardHeader>
            <h2 className='font-formal text-xl tracking-tight'>生成小故事</h2>
        </CardHeader>

        <CardBody className='prose dark:prose-invert prose-p:my-2 prose-ul:my-2 text-sm'>
            <p>
                通过<b className='text-foreground'>阅读辅助语言习得</b>是最有效记忆词汇的方式。
            </p>
            <p>
                点击继续，根据在该日期内记忆的单词生成一个故事：
            </p>
            <ul className='max-h-60 overflow-y-auto'>
                {comments.map((comment) => (
                    <li key={comment}>
                        <Markdown disableSave md={comment} />
                    </li>
                ))}
            </ul>
        </CardBody>

        <CardFooter className='flex gap-2 justify-end'>
            <Button
                variant='light'
                color='default'
                onPress={() => call.end(false)}
            >
                取消
            </Button>
            <Button
                variant='flat'
                startContent={<PiMagicWandDuotone className='text-lg' />}
                color='default'
                onPress={() => call.end(true)}
            >
                生成
            </Button>
        </CardFooter>
    </Card>
))
