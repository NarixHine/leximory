'use client'

import { useState } from 'react'
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from '@heroui/react'
import { ChatCircleDotsIcon } from '@phosphor-icons/react'
import { SubjectiveFeedback } from '@repo/schema/paper'
import { useChat } from '@ai-sdk/react'

/**
 * Appeal button that opens a dialog for the student to ask questions about marking.
 * Uses streaming AI to answer questions about why points were deducted.
 */
export function AppealButton({ sectionId, sectionType, feedback }: {
    sectionId: string
    sectionType: string
    feedback: SubjectiveFeedback
}) {
    const { isOpen, onOpen, onOpenChange } = useDisclosure()
    const [question, setQuestion] = useState('')

    const { messages, append, isLoading } = useChat({
        api: '/api/appeal',
        body: { sectionId, sectionType, feedback },
    })

    const handleSubmit = () => {
        if (!question.trim()) return
        append({ role: 'user', content: question })
        setQuestion('')
    }

    return (
        <>
            <Button
                size='sm'
                variant='flat'
                color='secondary'
                startContent={<ChatCircleDotsIcon />}
                onPress={onOpen}
            >
                申述与提问
            </Button>
            <Modal isOpen={isOpen} onOpenChange={onOpenChange} size='lg' scrollBehavior='inside'>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>申述与提问</ModalHeader>
                            <ModalBody>
                                <div className='flex flex-col gap-3 max-h-80 overflow-y-auto'>
                                    {messages.map((msg) => (
                                        <div key={msg.id} className={`text-sm p-2 rounded-medium ${msg.role === 'user' ? 'bg-primary-50 ml-8' : 'bg-default-100 mr-8'}`}>
                                            {msg.content}
                                        </div>
                                    ))}
                                    {messages.length === 0 && (
                                        <p className='text-sm text-default-400'>你可以在此处就本题的评分提出疑问，例如询问扣分原因或正确用法。</p>
                                    )}
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <div className='flex gap-2 w-full'>
                                    <Input
                                        value={question}
                                        onValueChange={setQuestion}
                                        placeholder='输入你的问题……'
                                        variant='bordered'
                                        size='sm'
                                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                                    />
                                    <Button
                                        size='sm'
                                        color='primary'
                                        isLoading={isLoading}
                                        onPress={handleSubmit}
                                    >
                                        发送
                                    </Button>
                                </div>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    )
}
