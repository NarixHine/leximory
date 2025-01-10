'use client'

import { Button } from '@nextui-org/button'
import { useDisclosure, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@nextui-org/modal'
import { useAtomValue } from 'jotai'
import { isReadOnlyAtom } from '../atoms'

export default function Prompt() {
    const isReadOnly = useAtomValue(isReadOnlyAtom)
    const { isOpen, onOpenChange } = useDisclosure({ defaultOpen: true })

    return <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
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
                            它默认不会出现在你的主页，但你可以点击右下角的按钮将其钉选。
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant='light' onPress={onClose}>
                            关闭
                        </Button>
                    </ModalFooter>
                </>
            )}
        </ModalContent>
    </Modal>
}
