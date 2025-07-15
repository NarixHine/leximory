'use client'

import { useState, useTransition } from 'react'
import { Button } from '@heroui/button'
import { Alert } from '@heroui/alert'
import { regenerateTimesQuiz } from '../actions'
import { PiGear, PiCalendar } from 'react-icons/pi'
import { momentSH } from '@/lib/moment'
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure
} from '@heroui/modal'
import { DatePicker } from '@heroui/date-picker'
import { parseDate, DateValue } from '@internationalized/date'

export default function RegenerateTimesQuizButton() {
    const [message, setMessage] = useState('')
    const [date, setDate] = useState<DateValue | null>(parseDate(momentSH().format('YYYY-MM-DD')))
    const [isPending, startTransition] = useTransition()
    const { isOpen, onOpenChange, onOpen, onClose } = useDisclosure()

    const handleRegenerate = () => {
        if (!date) {
            setMessage('Error: Please select a date.')
            return
        }
        startTransition(async () => {
            setMessage('')
            try {
                const result = await regenerateTimesQuiz(date.toString())
                setMessage(result.message)
            } catch (error) {
                setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
        })
    }

    return (
        <>
            <Button
                startContent={<PiCalendar />}
                onPress={onOpen}
                variant='flat'
                color='primary'
                fullWidth
            >
                Regenerate Times Quiz
            </Button>
            <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                <ModalContent>
                    <ModalHeader>Regenerate Quiz</ModalHeader>
                    <ModalBody>
                        <div className='space-y-4'>
                            <DatePicker
                                label='Select Date'
                                value={date}
                                onChange={setDate}
                            />
                            {message && (
                                <Alert
                                    color={message.includes('Error') ? 'danger' : 'success'}
                                    variant='flat'
                                    description={message}
                                />
                            )}
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant='flat' color='danger' onPress={() => {
                            onClose()
                            setMessage('')
                        }}>
                            Cancel
                        </Button>
                        <Button
                            startContent={!isPending && <PiGear />}
                            onPress={handleRegenerate}
                            isLoading={isPending}
                            color='primary'
                            isDisabled={!date}
                        >
                            {isPending ? 'Regenerating...' : 'Regenerate'}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    )
}
