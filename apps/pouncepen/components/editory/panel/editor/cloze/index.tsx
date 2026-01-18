'use client'

import Tiptap from '../../tiptap'
import { useState } from 'react'
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from '@heroui/react'
import { toFilled } from 'es-toolkit/array'
import { clone } from 'es-toolkit'
import { ClozeData } from '@/components/editory/generators/types'
import RevisePaper from '../revise-paper'

export default function ClozeEditor({
    data,
    setData,
}: {
    data: ClozeData
    setData: (data: ClozeData) => void
    id?: string
}) {
    const [distractors, setDistractors] = useState<string[]>(['', '', ''])
    const [blankedWord, setBlankedWord] = useState<string>('')
    const { isOpen, onOpen, onOpenChange } = useDisclosure()

    return <div className='flex flex-col gap-2 before:content-["Cloze"] before:text-secondary-300 before:font-bold before:-mb-4 my-5'>
        <RevisePaper data={data} />
        <Modal
            isOpen={isOpen}
            onOpenChange={onOpenChange}
        >
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className='flex flex-col gap-1'>设置干扰项</ModalHeader>
                        <ModalBody>
                            {
                                distractors.map((distractor, index) => (
                                    <Input
                                        key={index}
                                        autoFocus={index === 0}
                                        value={distractor}
                                        label={`干扰项 ${index + 1}`}
                                        onValueChange={(value) => {
                                            setDistractors(toFilled(distractors, value, index, index + 1))
                                        }}
                                        variant='underlined'
                                    />
                                ))
                            }
                        </ModalBody>
                        <ModalFooter>
                            <Button variant='light' onPress={onClose}>
                                关闭
                            </Button>
                            <Button color='secondary' variant='flat' onPress={() => {
                                const newData = clone(data)
                                const questions = newData.questions
                                const questionToUpdate = questions.find(q => q.original === blankedWord)
                                if (questionToUpdate) {
                                    questionToUpdate.distractors = distractors
                                } else {
                                    questions.push({
                                        original: blankedWord,
                                        distractors,
                                    })
                                }
                                setData(newData)
                                onClose()
                            }}>
                                保存
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
        <Tiptap
            content={data.text}
            blank={(word) => {
                setBlankedWord(word)
                setDistractors(data.questions.find(q => q.original === word)?.distractors ?? ['', '', ''])
                onOpen()
            }}
            unblank={(word) => {
                setData({
                    ...data,
                    questions: data.questions.filter(q => q.original !== word),
                })
            }}
            ai={{
                setData,
                data
            }}
            onUpdate={({ editor }) => {
                setData({
                    ...data,
                    text: editor.getHTML()
                })
            }}
        />
    </div>
}
