'use client'

import { useState, useTransition, useMemo } from 'react'
import { changeUserEmail, changeUserPlan, deleteUser } from '../actions'
import { Plan, PLANS } from '@/lib/config'
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/table'
import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import { Select, SelectItem } from '@heroui/select'
import { Chip } from '@heroui/chip'
import { Alert } from '@heroui/alert'
import { Avatar } from '@heroui/avatar'
import type { getAllUsers } from '../data-fetching'

export default function UsersList({ users }: { users: Awaited<ReturnType<typeof getAllUsers>> }) {
    const [editingUser, setEditingUser] = useState<string | null>(null)
    const [newEmail, setNewEmail] = useState('')
    const [message, setMessage] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [isPending, startTransition] = useTransition()

    // Filter users based on search query
    const filteredUsers = useMemo(() => {
        if (!searchQuery.trim()) return users

        const query = searchQuery.toLowerCase()
        return users.filter(user =>
            user.username.toLowerCase().includes(query) ||
            (user.email && user.email.toLowerCase().includes(query)) ||
            user.plan.toLowerCase().includes(query)
        )
    }, [users, searchQuery])

    const handleEmailChange = (userId: string, email: string) => {
        if (!email.trim()) return

        startTransition(async () => {
            setMessage('')
            try {
                await changeUserEmail(userId, email)
                setMessage('Email updated successfully')
                setEditingUser(null)
                setNewEmail('')
            } catch (error) {
                setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
        })
    }

    const handlePlanChange = (userId: string, newPlan: Plan) => {
        startTransition(async () => {
            setMessage('')
            try {
                await changeUserPlan(userId, newPlan)
                setMessage('Plan updated successfully')
            } catch (error) {
                setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
        })
    }

    const handleDeleteUser = (userId: string) => {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return
        }

        startTransition(async () => {
            setMessage('')
            try {
                await deleteUser(userId)
                setMessage('User deleted successfully')
            } catch (error) {
                setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
        })
    }

    const formatDate = (dateString: string | undefined | null) => {
        if (!dateString) return 'Never'
        return new Date(dateString).toLocaleDateString()
    }

    const getPlanColor = (plan: Plan) => {
        switch (plan) {
            case 'leximory': return 'secondary'
            case 'polyglot': return 'primary'
            case 'bilingual': return 'success'
            default: return 'default'
        }
    }

    return (
        <div className='flex flex-col gap-4 w-full items-center'>
            {message && (
                <div className='px-6'>
                    <Alert
                        color={message.includes('Error') ? 'danger' : 'success'}
                        variant='flat'
                        description={message}
                    />
                </div>
            )}

            {/* Search Filter */}
            <div className='px-6 mx-auto min-w-96'>
                <Input
                    placeholder='Search users by name, email, or plan...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    size='sm'
                    className='max-w-md'
                    isClearable
                    onClear={() => setSearchQuery('')}
                />
                <div className='mt-2 text-tiny opacity-60'>
                    {filteredUsers.length} of {users.length} users
                </div>
            </div>

            <Table
                isVirtualized
                aria-label='Users table'
            >
                <TableHeader>
                    <TableColumn>USER</TableColumn>
                    <TableColumn>PLAN</TableColumn>
                    <TableColumn>CREATED</TableColumn>
                    <TableColumn>LAST SIGN IN</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                </TableHeader>
                <TableBody emptyContent={searchQuery ? 'No users found matching your search' : 'No users found'}>
                    {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell>
                                <div className='flex items-center gap-3'>
                                    <Avatar
                                        name={user.username}
                                        size='sm'
                                        src={user.avatarUrl}
                                    />
                                    <div className='flex flex-col'>
                                        <span className='text-small font-medium'>{user.username}</span>
                                        {editingUser === user.id ? (
                                            <div className='flex items-center gap-2 mt-1'>
                                                <Input
                                                    type='email'
                                                    value={newEmail}
                                                    onChange={(e) => setNewEmail(e.target.value)}
                                                    placeholder='Enter email'
                                                    size='sm'
                                                    className='max-w-48'
                                                    isDisabled={isPending}
                                                />
                                                <Button
                                                    size='sm'
                                                    color='success'
                                                    variant='flat'
                                                    onPress={() => handleEmailChange(user.id, newEmail)}
                                                    isDisabled={isPending}
                                                    isIconOnly
                                                >
                                                    ✓
                                                </Button>
                                                <Button
                                                    size='sm'
                                                    variant='light'
                                                    onPress={() => {
                                                        setEditingUser(null)
                                                        setNewEmail('')
                                                    }}
                                                    isIconOnly
                                                >
                                                    ✕
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className='flex items-center gap-2'>
                                                <Button
                                                    variant='light'
                                                    size='sm'
                                                    className='justify-start p-0 h-auto min-w-0'
                                                    onPress={() => {
                                                        setEditingUser(user.id)
                                                        setNewEmail(user.email || '')
                                                    }}
                                                >
                                                    <span className='text-tiny opacity-60'>
                                                        {user.email || 'No email'}
                                                    </span>
                                                </Button>
                                                <Chip
                                                    size='sm'
                                                    variant='dot'
                                                    className='border-none'
                                                    color={user.emailConfirmedAt ? 'success' : 'warning'}
                                                >
                                                    {user.emailConfirmedAt ? 'Verified' : 'Unverified'}
                                                </Chip>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Select
                                    size='sm'
                                    selectedKeys={[user.plan]}
                                    onChange={(e) => {
                                        const selectedPlan = e.target.value as Plan
                                        if (selectedPlan !== user.plan) {
                                            handlePlanChange(user.id, selectedPlan)
                                        }
                                    }}
                                    isDisabled={isPending}
                                    className='w-33.5'
                                    renderValue={() => (
                                        <Chip
                                            size='sm'
                                            variant='flat'
                                            color={getPlanColor(user.plan)}
                                            className='capitalize'
                                        >
                                            {user.plan}
                                        </Chip>
                                    )}
                                >
                                    {PLANS.map((plan) => (
                                        <SelectItem key={plan} className='capitalize'>
                                            {plan}
                                        </SelectItem>
                                    ))}
                                </Select>
                            </TableCell>
                            <TableCell>
                                <span className='text-small opacity-60'>
                                    {formatDate(user.createdAt)}
                                </span>
                            </TableCell>
                            <TableCell>
                                <span className='text-small opacity-60'>
                                    {formatDate(user.lastSignInAt)}
                                </span>
                            </TableCell>
                            <TableCell>
                                <Button
                                    size='sm'
                                    color='danger'
                                    variant='flat'
                                    onPress={() => handleDeleteUser(user.id)}
                                    isDisabled={isPending}
                                >
                                    Delete
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
