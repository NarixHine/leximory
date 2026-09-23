'use client'

import { useTransition } from 'react'
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/modal'
import { Button } from '@heroui/button'
import { Avatar } from '@heroui/avatar'
import { toast } from 'sonner'
import { PiWarningOctagonDuotone } from 'react-icons/pi'
import { deleteUser } from '../actions'
import type { AdminUser } from '../data-fetching'

export default function DeleteUserModal({
    user,
    onClose,
}: {
    user: AdminUser | null
    onClose: () => void
}) {
    const [isPending, startTransition] = useTransition()

    const handleDelete = () => {
        if (!user) return

        startTransition(async () => {
            try {
                await deleteUser(user.id)
                toast.success(`Deleted ${user.username}`)
                onClose()
            } catch (actionError) {
                toast.error(
                    actionError instanceof Error ? actionError.message : 'Failed to delete user',
                )
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
                    <div className='grid size-9 place-items-center rounded-full bg-danger-50'>
                        <PiWarningOctagonDuotone className='size-5 text-danger-500' />
                    </div>
                    <span className='text-base'>Delete user</span>
                </ModalHeader>
                <ModalBody className='flex flex-col gap-4'>
                    <p className='text-sm text-default-600'>
                        This permanently deletes the account and cannot be undone.
                    </p>
                    {user && (
                        <div className='flex items-center gap-3 rounded-2xl bg-default-50 p-3'>
                            <Avatar
                                size='sm'
                                src={user.avatarUrl ?? undefined}
                                name={user.username}
                            />
                            <div className='min-w-0'>
                                <div className='truncate text-sm'>{user.username}</div>
                                <div className='truncate font-mono text-xs text-default-500'>
                                    {user.email ?? 'No email'}
                                </div>
                            </div>
                        </div>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant='light' onPress={onClose} isDisabled={isPending}>
                        Cancel
                    </Button>
                    <Button color='danger' onPress={handleDelete} isLoading={isPending}>
                        Delete permanently
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    )
}
