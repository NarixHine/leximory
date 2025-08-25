'use client'

import Tiptap from '../../tiptap'
import { useState } from 'react'
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from '@heroui/react'
import { omit, toMerged } from 'es-toolkit'
import { GrammarData } from '@/components/editory/generators/types'

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

    return <div className='flex flex-col gap-2 before:content-["Grammar"] before:text-primary-300 before:font-bold before:-mb-4 my-5'>
        <Modal
            isOpen={isOpen}
            onOpenChange={onOpenChange}
        >
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className='flex flex-col gap-1'>Edit the hint</ModalHeader>
                        <ModalBody>
                            <Input
                                autoFocus
                                value={hint}
                                label='Hint'
                                color='primary'
                                description='optional: for adjectives, adverbs and verbs'
                                startContent={<span className='text-sm'>{'('}</span>}
                                endContent={<span className='text-sm'>{')'}</span>}
                                onValueChange={setHint}
                                variant='underlined'
                            />
                        </ModalBody>
                        <ModalFooter>
                            <Button variant='light' onPress={onClose}>
                                Close
                            </Button>
                            <Button color='primary' variant='flat' onPress={() => {
                                setData(toMerged(data, {
                                    hints: {
                                        [blankedWord]: hint
                                    }
                                }))
                                onClose()
                            }}>
                                Save
                            </Button>
                        </ModalFooter>
                    </>
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
