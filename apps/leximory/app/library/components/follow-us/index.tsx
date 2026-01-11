'use client'

import { Button } from '@heroui/button'
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from '@heroui/modal'
import { PiTelevisionDuotone } from 'react-icons/pi'
import Link from 'next/link'
import { FaBilibili } from 'react-icons/fa6'
import { cn } from '@heroui/react'
import { showFollowUsModal } from './actions'
import { useRouter } from 'next/navigation'
import { BILIBILI_LINK } from '@repo/env/config'

export default function FollowUs() {
    const { isOpen, onOpenChange } = useDisclosure({ defaultOpen: true })
    const router = useRouter()

    return (
        <Modal
            backdrop='blur'
            isDismissable={false}
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            hideCloseButton
        >
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className={cn('flex items-center gap-2')}>
                            <FaBilibili />在 B 站上关注 Leximory
                        </ModalHeader>

                        <ModalBody className={'prose dark:prose-invert prose-p:my-1'}>
                            <p>
                                嗨，我们会在 B 站上不定期发布一些<span className='font-semibold'>学习资料</span>和<span className='font-semibold'>使用教程</span>。如欲了解最新开发进度，也请关注<Link href={BILIBILI_LINK} className='text-primary underline underline-offset-4'>我们的频道</Link>。
                            </p>
                            <p>
                                Leximory 暂时还颇多漏洞。如果你有任何的{' '}<span className='font-semibold'>bug 反馈</span>和<span className='font-semibold'>功能建议</span>，也欢迎在 B 站上给我们留言。
                            </p>
                        </ModalBody>

                        <ModalFooter>
                            <Button variant='light' color='primary' onPress={async () => {
                                await showFollowUsModal()
                                onClose()
                            }}>
                                以后再说
                            </Button>
                            <Button onPress={async () => {
                                await showFollowUsModal()
                                router.push(BILIBILI_LINK)
                                onClose()
                            }} startContent={<PiTelevisionDuotone />} color='primary'>
                                关注我们
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    )
}
