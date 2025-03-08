'use client'

import Markdown from '@/components/markdown'
import H from '@/components/ui/h'
import { Button } from '@heroui/button'
import { Card, CardBody, CardFooter, CardHeader } from '@heroui/card'
import { createCallable } from 'react-call'
import { PiTornadoDuotone } from 'react-icons/pi'

type Response = boolean

export const ConfirmStory = createCallable<{ comments:string[] }, Response>(({ call, comments }) => (
    <Card role='dialog' className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 p-6' shadow='sm'>
        <CardHeader>
            <H usePlayfair className='text-2xl'>生成小故事</H>
        </CardHeader>
        
        <CardBody className='prose dark:prose-invert prose-p:my-2 prose-ul:my-2'>
            <p>
                通过<b>阅读辅助语言习得</b>是最有效记忆词汇的方式。
            </p>
            <p>
                点击继续则会根据在该日期内记忆的单词生成一个故事（消耗2次AI注释生成额度）：

            </p>
            <ul className='max-h-[300px] overflow-y-auto'>
                {comments.map((comment) => (
                    <li key={comment}>
                        <Markdown disableSave md={comment}></Markdown>
                    </li>
                ))}
            </ul>
        </CardBody>

        <CardFooter className='flex gap-2 justify-end'>
            <Button
                variant='light'
                color='secondary'
                onPress={() => call.end(false)}
            >
                取消
            </Button>
            <Button
                variant='solid'
                startContent={<PiTornadoDuotone className='text-xl' />}
                color='secondary'
                onPress={() => call.end(true)}
            >
                生成
            </Button>
        </CardFooter>
    </Card>
))

