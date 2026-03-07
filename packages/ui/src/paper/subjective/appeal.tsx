'use client'

import { useState, useRef, useEffect } from 'react'
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure, Spinner } from '@heroui/react'
import { ChatCircleDotsIcon, PaperPlaneRightIcon } from '@phosphor-icons/react'
import { SubjectiveFeedback } from '@repo/schema/paper'
import { DefaultChatTransport } from 'ai'
import { useChat } from '@ai-sdk/react'
import { Streamdown } from 'streamdown'

/**
 * Appeal button that opens a dialog for the student to ask questions about marking.
 * Uses streaming AI to answer questions about why points were deducted.
 */
export function AppealButton({ sectionId, sectionType, feedback, context }: {
    sectionId: string
    sectionType: string
    feedback: SubjectiveFeedback
    context: string
}) {
    const { isOpen, onOpen, onOpenChange } = useDisclosure()
    const [question, setQuestion] = useState('')
    const scrollRef = useRef<HTMLDivElement>(null)

    const { messages, sendMessage, status } = useChat({
        transport: new DefaultChatTransport({
            api: '/api/appeal',
            body: { sectionId, sectionType, feedback, context },
        }),
    })

    const isLoading = status === 'streaming' || status === 'submitted'

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        const el = scrollRef.current
        if (el) {
            el.scrollTop = el.scrollHeight
        }
    }, [messages, status])

    const handleSubmit = () => {
        if (!question.trim() || isLoading) return
        sendMessage({ text: question })
        setQuestion('')
    }

    return (
        <>
            <Button
                size='sm'
                variant='flat'
                color='secondary'
                startContent={<ChatCircleDotsIcon size={16} />}
                onPress={onOpen}
            >
                申述与提问
            </Button>
            <Modal isOpen={isOpen} onOpenChange={onOpenChange} size='lg' scrollBehavior='inside'>
                <ModalContent>
                    {() => (
                        <>
                            <ModalHeader className='text-base font-medium'>申述与提问</ModalHeader>
                            <ModalBody className='px-6 py-2'>
                                <div ref={scrollRef} className='flex flex-col gap-3 min-h-48 max-h-96 overflow-y-auto py-3'>
                                    {messages.length === 0 ? (
                                        <div className='flex-1 flex items-center justify-center'>
                                            <p className='text-sm text-default-400 text-center leading-relaxed'>
                                                你可以在此处就本题的评分提出疑问，<br />例如询问扣分原因或正确用法。
                                            </p>
                                        </div>
                                    ) : (
                                        messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`text-sm leading-relaxed px-3 py-3 rounded-large max-w-[85%] whitespace-pre-wrap ${msg.role === 'user'
                                                    ? 'bg-primary-50 self-end'
                                                    : 'bg-default-100 self-start'
                                                    }`}
                                            >
                                                {msg.parts.map((part, i) =>
                                                    'text' in part ? <Streamdown key={`${msg.id}-${i}`}>{part.text}</Streamdown> : null
                                                )}
                                            </div>
                                        ))
                                    )}
                                    {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
                                        <div className='self-start px-3 py-2'>
                                            <Spinner size='sm' variant='wave' />
                                        </div>
                                    )}
                                </div>
                            </ModalBody>
                            <ModalFooter className='px-6 pb-6 pt-2'>
                                <div className='flex gap-2 w-full'>
                                    <Input
                                        value={question}
                                        onValueChange={setQuestion}
                                        placeholder='输入你的问题……'
                                        variant='flat'
                                        classNames={{ inputWrapper: 'shadow-none' }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                handleSubmit()
                                            }
                                        }}
                                    />
                                    <Button
                                        color='primary'
                                        isIconOnly
                                        isLoading={isLoading}
                                        onPress={handleSubmit}
                                        isDisabled={!question.trim()}
                                    >
                                        <PaperPlaneRightIcon size={16} />
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
