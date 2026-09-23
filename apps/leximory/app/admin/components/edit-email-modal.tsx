'use client'

import { useEffect, useState, useTransition } from 'react'
import {
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
} from '@heroui/modal'
import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import { Avatar } from '@heroui/avatar'
import { toast } from 'sonner'
import { PiEnvelopeSimpleDuotone } from 'react-icons/pi'
import { changeUserEmail } from '../actions'
import type { AdminUser } from '../data-fetching'

export default function EditEmailModal({
    user,
    onClose,
}: {
    user: AdminUser | null
    onClose: () => void
}) {
    const [email, setEmail] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        setEmail(user?.email ?? '')
        setError(null)
    }, [user])

    const handleSave = () => {
        if (!user) return

        const next = email.trim()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
            setError('Enter a valid email address')
            return
        }
        if (next.toLowerCase() === (user.email ?? '').toLowerCase()) {
            setError('This is already the current email')
            return
        }

        startTransition(async () => {
            try {
                await changeUserEmail(user.id, next)
                toast.success(`Email updated for ${user.username}`)
                onClose()
            } catch (actionError) {
                const message =
                    actionError instanceof Error ? actionError.message : 'Failed to update email'
                setError(message)
                toast.error(message)
            }
        })
    }

    return (
        <Modal
            isOpen={Boolean(user)}
            onOpenChange={open => {
                if (!open && !isPending) onClose()
            }}
            placement='center'
            isDismissable={!isPending}
        >
            <ModalContent>
                <ModalHeader className='flex items-center gap-3'>
                    <Avatar size='sm' src={user?.avatarUrl ?? undefined} name={user?.username} />
                    <div className='flex flex-col'>
                        <span className='text-base leading-tight'>Change email</span>
                        <span className='font-mono text-xs font-normal text-default-500'>
                            {user?.username}
                        </span>
                    </div>
                </ModalHeader>
                <ModalBody>
                    <Input
                        autoFocus
                        type='email'
                        label='Email address'
                        labelPlacement='outside'
                        placeholder='name@example.com'
                        value={email}
                        onValueChange={value => {
                            setEmail(value)
                            if (error) setError(null)
                        }}
                        isInvalid={Boolean(error)}
                        errorMessage={error ?? undefined}
                        isDisabled={isPending}
                        startContent={<PiEnvelopeSimpleDuotone className='size-4 text-default-400' />}
                        onKeyDown={event => {
                            if (event.key === 'Enter') handleSave()
                        }}
                    />
                    <p className='text-xs text-default-500'>
                        The new address is marked as confirmed. The user is not notified.
                    </p>
                </ModalBody>
                <ModalFooter>
                    <Button variant='light' onPress={onClose} isDisabled={isPending}>
                        Cancel
                    </Button>
                    <Button color='primary' onPress={handleSave} isLoading={isPending}>
                        Save email
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    )
}
