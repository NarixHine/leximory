'use client'

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/modal'
import { useDisclosure } from '@heroui/use-disclosure'
import { useState } from 'react'
import { smartImport } from './actions'
import { useSetAtom } from 'jotai'
import { ArrowSquareInIcon, MagicWandIcon } from '@phosphor-icons/react'
import { useAction } from '@repo/service'
import { MAX_FILE_SIZE } from '@repo/env/config'
import { toast } from 'sonner'
import { ProtectedButton } from '@repo/ui/protected-button'
import { editoryItemsAtom } from '@repo/ui/paper/atoms'
import { FileUpload } from '@repo/ui/file-upload'
import { Button } from '@heroui/react'

export function ImportButton() {
    const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure()
    const setEditoryItems = useSetAtom(editoryItemsAtom)
    const [file, setFile] = useState<File | null>(null)

    const { execute, isPending } = useAction(smartImport, {
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

    async function handleAIImportClick() {
        if (!file) return
        if (file.size > MAX_FILE_SIZE) toast.error(`File size exceeds the limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
        execute(file)
    }

    return (
        <>
            <ProtectedButton
                color='default'
                variant='flat'
                startContent={<ArrowSquareInIcon />}
                onPress={onOpen}
                size='lg'
            >
                AI 导入
            </ProtectedButton>
            <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop='opaque'>
                <ModalContent>
                    <ModalHeader className='flex flex-col gap-1'>AI 导入</ModalHeader>
                    <ModalBody className='gap-0'>
                        <p>
                            <b>智能导入</b> PDF 试卷（须含答案），转换为 PouncePen 格式以便使用编辑器进行操作。
                        </p>
                        <FileUpload onChange={(files) => { setFile(files[0]) }} disabled={isPending} />
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