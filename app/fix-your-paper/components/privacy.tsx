'use client'

import { Button } from '@heroui/button'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from '@heroui/modal'
import { PiLockKey } from 'react-icons/pi'
import { CHINESE_ZCOOL, postFontFamily } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { fixYourPaperGitHubLink } from '@/lib/config'

export default function Privacy() {
    const { isOpen, onOpen, onOpenChange } = useDisclosure()

    return <>
        <Button
            className='rounded-full text-lg text-default-700'
            startContent={<PiLockKey />}
            isIconOnly
            size='sm'
            variant='light'
            onPress={onOpen}
        ></Button>
        <Modal hideCloseButton isOpen={isOpen} onOpenChange={onOpenChange}>
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className={cn(CHINESE_ZCOOL.className, 'flex flex-col gap-1 pb-0')}>隐私声明</ModalHeader>
                        <ModalBody style={{ fontFamily: postFontFamily }} className='prose prose-sm dark:prose-invert'>
                            <div className='space-y-4'>
                                <p>你上传的文件将会被发送至 Google 的 AI 模型，但不会被 <span className='italic'>Fix. Your. Paper.</span> 存储。也就是说，我们无法看到你上传的试卷内容。</p>
                                <p className='font-bold'>但你没有必要相信我们——</p>
                                <p>由于本服务开源，你可以在 <Link href={fixYourPaperGitHubLink} target='_blank' className='underline underline-offset-2'>GitHub</Link> 上自己检视源代码。</p>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button color='primary' onPress={onClose}>
                                关闭
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    </>
} 
