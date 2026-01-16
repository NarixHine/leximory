'use client'

import { Button } from '@heroui/button'
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/modal'
import { useDisclosure } from '@heroui/use-disclosure'
import { useRef } from 'react'
import { smartImport } from './actions'
import { useSetAtom } from 'jotai'
import { editoryItemsAtom } from '@/components/editory/atoms'
import { ArrowSquareInIcon, MagicWandIcon } from '@phosphor-icons/react'
import { useAction } from 'next-safe-action/hooks'
import { MAX_FILE_SIZE } from '@repo/env/config'
import { toast } from 'sonner'
import { ProtectedButton } from '@repo/ui/protected-button'

export function ImportButton() {
    const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure()
    const setEditoryItems = useSetAtom(editoryItemsAtom)
    const fileInputRef = useRef<HTMLInputElement>(null)

    function handleAIImportClick() {
        fileInputRef.current?.click()
    }

    const { execute, isPending, } = useAction(smartImport, {
        onSuccess: ({ data }) => {
            if (data) {
                setEditoryItems(data)
                onClose()
            }
        },
        onError: () => {
            toast.error(`Import failed.`)
        }
    })

    async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        if (!file) return
        if (file.size > MAX_FILE_SIZE) toast.error(`File size exceeds the limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
        execute(file)
    }


    return (
        <>
            <ProtectedButton
                color='secondary'
                variant='flat'
                startContent={<ArrowSquareInIcon />}
                onPress={onOpen}
                size='lg'
            >
                AI 导入
            </ProtectedButton>
            <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                <ModalContent>
                    <ModalHeader className='flex flex-col gap-1'>AI 导入</ModalHeader>
                    <ModalBody>
                        <p>
                            <b>智能导入</b> PDF 试卷（须含答案），转换为 GemPen 格式以便使用编辑器进行操作。
                        </p>
                        <input type='file' ref={fileInputRef} onChange={handleFileChange} className='hidden' accept='.pdf' />
                    </ModalBody>
                    <ModalFooter>
                        <Button startContent={!isPending && <MagicWandIcon size={20} />} color='secondary' onPress={handleAIImportClick} isLoading={isPending}>
                            上传 PDF
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    )
}