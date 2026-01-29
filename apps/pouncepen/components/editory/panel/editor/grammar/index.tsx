'use client'

import Tiptap from '../../tiptap'
import { useState } from 'react'
import { Button, Form, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from '@heroui/react'
import { omit, toMerged } from 'es-toolkit'
import { GrammarData } from '@repo/schema/paper'
import { extractCodeContent } from '@repo/ui/paper/utils'

export default function GrammarEditor({
    data,
    setData,
}: {
    data: GrammarData
    setData: (data: GrammarData) => void
    id?: string
}) {
    const [hint, setHint] = useState<string>('')
    const [blankedWord, setBlankedWord] = useState<string>('')
    const { isOpen, onOpen, onOpenChange } = useDisclosure()

    return <div className='flex flex-col gap-2 before:content-["Grammar"] before:text-secondary-300 before:font-bold before:-mb-4 my-5'>
        <Modal
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            isKeyboardDismissDisabled
        >
            <ModalContent>
                {(onClose) => (
                    <Form className='w-full' onSubmit={(e) => {
                        e.preventDefault()

                        const newData = toMerged(data, {
                            hints: {
                                [blankedWord]: hint
                            }
                        })
                        
                        // clean up questions that are no longer in the text
                        const blanks = extractCodeContent(newData.text)
                        newData.hints = Object.fromEntries(
                            Object.entries(newData.hints).filter(([key]) => blanks.includes(key))
                        )

                        setData(newData)
                        onClose()
                    }}>
                        <ModalHeader className='flex flex-col gap-1 w-full'>设置提示词</ModalHeader>
                        <ModalBody className='w-full'>
                            <Input
                                autoFocus
                                value={hint}
                                label='提示词'
                                description='选填：适用于形容词、副词和动词'
                                startContent={<span className='text-sm'>{'('}</span>}
                                endContent={<span className='text-sm'>{')'}</span>}
                                onValueChange={setHint}
                                variant='underlined'
                            />
                        </ModalBody>
                        <ModalFooter className='w-full'>
                            <Button variant='light' onPress={onClose}>
                                关闭
                            </Button>
                            <Button type='submit' color='secondary' variant='flat'>
                                保存
                            </Button>
                        </ModalFooter>
                    </Form>
                )}
            </ModalContent>
        </Modal>
        <Tiptap
            key={data.id}
            content={data.text}
            blank={(word) => {
                setBlankedWord(word)
                setHint(data.hints[word] ?? '')
                onOpen()
            }}
            unblank={(word) => {
                setData({
                    ...data,
                    hints: omit(data.hints, [word]),
                })
            }}
            onUpdate={({ editor }) => {
                setData({
                    ...data,
                    text: editor.getHTML(),
                })
            }}
        />
    </div>
}
