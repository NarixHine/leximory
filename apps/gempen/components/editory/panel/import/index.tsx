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
        onError: (error) => {
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
            <Button
                color='secondary'
                variant='flat'
                startContent={<ArrowSquareInIcon />}
                onPress={onOpen}
                size='lg'
            >
                AI 导入
            </Button>
            <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                <ModalContent>
                    <ModalHeader className='flex flex-col gap-1'>Smart Import</ModalHeader>
                    <ModalBody>
                        <p>
                            <b>Automatically generate an assignment with AI</b> from a PDF of your exam, which must also include the key.
                        </p>
                        <input type='file' ref={fileInputRef} onChange={handleFileChange} className='hidden' accept='.pdf' />
                    </ModalBody>
                    <ModalFooter>
                        <Button startContent={!isPending && <MagicWandIcon size={20} />} color='secondary' onPress={handleAIImportClick} isLoading={isPending}>
                            Upload Exam PDF
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    )
}