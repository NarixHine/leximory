'use client'

import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from '@heroui/react'
import { useAction } from 'next-safe-action/hooks'
import { publishAssignmentAction } from './actions'
import { UploadIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useAtomValue } from 'jotai'
import { editoryItemsAtom } from '../../atoms'
import { useState } from 'react'

export function PublishButton() {
    const { isOpen, onOpenChange, onClose, onOpen } = useDisclosure()
    const quiz = useAtomValue(editoryItemsAtom)
    const [title, setTitle] = useState('')
    const { execute, isExecuting } = useAction(publishAssignmentAction, {
        onSuccess: () => {
            toast.success('发布成功')
            onClose()
        },
        onError: () => {
            toast.error('发布失败')
        },
    })

    const handlePublish = () => {
        execute({ quiz, title })
    }

    return (<>
        <Button
            onPress={onOpen}
            startContent={<UploadIcon />}
            color={'secondary'}
            variant='solid'
            size='lg'
        >
            Publish
        </Button>
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <ModalContent>
                <ModalHeader className='flex flex-col gap-1'>Publish Assignment</ModalHeader>
                <ModalBody>
                    <Input
                        label='Title'
                        placeholder='Enter assignment title'
                        value={title}
                        onValueChange={setTitle}
                    />
                    <p>
                        Are you sure you want to publish this assignment?
                    </p>
                    <p>
                        Once published, it will be available to students effective immediately,
                        and you <span className='font-semibold'>will <span className='text-danger'>not</span> be able to make edits.</span>
                    </p>
                </ModalBody>
                <ModalFooter>
                    <Button variant='light' className='text-default-700' onPress={onClose}>
                        Cancel
                    </Button>
                    <Button
                        color='secondary'
                        isLoading={isExecuting}
                        onPress={handlePublish}
                    >
                        Publish Now
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    </>)
}
