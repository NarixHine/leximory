'use client'

import { useState, useTransition } from 'react'
import { Button } from '@heroui/button'
import { Alert } from '@heroui/alert'
import { regenerateDailyTimes } from '../actions'
import { PiGear } from 'react-icons/pi'

export default function RegenerateTimesButton() {
    const [message, setMessage] = useState('')
    const [isPending, startTransition] = useTransition()

    const handleRegenerate = () => {
        startTransition(async () => {
            setMessage('')
            try {
                const result = await regenerateDailyTimes()
                setMessage(result.message)
            } catch (error) {
                setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
        })
    }

    return (
        <div className='space-y-3'>
            <Button
                startContent={!isPending && <PiGear />}
                onPress={handleRegenerate}
                isLoading={isPending}
                color='primary'
                className='w-full'
                size='md'
            >
                {isPending ? 'Regenerating...' : 'Regenerate Daily Times'}
            </Button>

            {message && (
                <Alert
                    color={message.includes('Error') ? 'danger' : 'success'}
                    variant='flat'
                    description={message}
                />
            )}
        </div>
    )
}
