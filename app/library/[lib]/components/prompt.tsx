'use client'

import { Button } from "@heroui/button"
import { useDisclosure, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal"
import { useAtomValue } from 'jotai'
import { isReadOnlyAtom, libAtom, priceAtom } from '../atoms'
import { PiArrowUDownLeftDuotone, PiShoppingCartDuotone } from 'react-icons/pi'
import { useTransition } from 'react'
import { star } from './actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function Prompt() {
    const isReadOnly = useAtomValue(isReadOnlyAtom)
    const { isOpen, onOpenChange } = useDisclosure({ defaultOpen: true })
    const price = useAtomValue(priceAtom)
    const lib = useAtomValue(libAtom)
    const [isTransitioning, startTransition] = useTransition()
    const router = useRouter()

    return <Modal isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={false} isKeyboardDismissDisabled={false} hideCloseButton>
        <ModalContent>
            {(onClose) => (
                <>
                    <ModalHeader className='flex flex-col gap-1'>提示</ModalHeader>
                    <ModalBody>
                        <p>
                            你正在浏览的内容来自共享文库。
                        </p>
                        <p>
                            你的权限是：<span className='font-bold'>{isReadOnly ? '只读' : '读写'}</span>。
                        </p>
                        <p>
                            在访问前，你必须先获取本文库并将其钉选到主页。
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            startContent={<PiArrowUDownLeftDuotone className='size-5' />}
                            color='primary'
                            variant='flat'
                            onPress={() => {
                                router.back()
                            }}
                        >
                            返回
                        </Button>
                        <Button
                            color='primary'
                            isLoading={isTransitioning}
                            onPress={() => {
                                startTransition(async () => {
                                    const { success, message } = await star(lib)
                                    if (success) {
                                        onClose()
                                    }
                                    else {
                                        toast.error(message)
                                    }
                                })
                            }}
                            startContent={!isTransitioning && <PiShoppingCartDuotone className='size-5' />}>
                            用 {price} LexiCoin 购买
                        </Button>
                    </ModalFooter>
                </>
            )}
        </ModalContent>
    </Modal>
}
