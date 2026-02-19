'use client'

import { Button } from '@heroui/button'
import { CardBody, CardFooter, CardHeader } from '@heroui/card'
import { createCallable } from 'react-call'
import { Card } from '@heroui/card'
import { PiTrashDuotone } from 'react-icons/pi'
import H from '@/components/ui/h'

export const ConfirmUnstar = createCallable<void, boolean>(({ call }) => (
    <Card role='dialog' className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 p-6'>
        <CardHeader>
            <H className='text-2xl'>移除收藏</H>
        </CardHeader>

        <CardBody className='prose dark:prose-invert prose-p:my-2 prose-ul:my-2'>
            <p>
                要移除本共享文库吗？移除后将无法再访问该文库，也不会收到本文库的词汇更新。如果想要重新收藏，需要再次购买。
            </p>
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
                startContent={<PiTrashDuotone className='text-xl' />}
                color='primary'
                onPress={() => call.end(true)}
            >
                移除收藏
            </Button>
        </CardFooter>
    </Card>
))
