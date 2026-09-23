'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import {
    Avatar,
    Button,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Input,
    Pagination,
    Select,
    SelectItem,
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
} from '@heroui/react'
import { toast } from 'sonner'
import {
    PiCheckCircleDuotone,
    PiDotsThreeVertical,
    PiEnvelopeSimpleDuotone,
    PiMagnifyingGlass,
    PiMinusCircleDuotone,
    PiTrashDuotone,
    PiUserDuotone,
} from 'react-icons/pi'
import { PLANS, Plan } from '@repo/env/config'
import { cn } from '@/lib/utils'
import { changeUserPlan } from '../actions'
import type { AdminUser } from '../data-fetching'
import { PLAN_SHORT_LABEL } from '../plan'
import { DEFAULT_SORT, sortUsers, SortKey, SortRule } from '../sort'
import PlanTag from './plan-tag'
import SortControl from './sort-control'
import EditEmailModal from './edit-email-modal'
import DeleteUserModal from './delete-user-modal'

const PAGE_SIZE = 10

const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
})

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function formatDate(value: string | null) {
    if (!value) return '—'
    return dateFormatter.format(new Date(value))
}

function formatLastSeen(value: string | null) {
    if (!value) return 'Never'
    const days = Math.round((Date.now() - new Date(value).getTime()) / 86_400_000)
    if (Math.abs(days) < 30) return relativeFormatter.format(-days, 'day')
    return dateFormatter.format(new Date(value))
}

export default function UserTable({ users }: { users: AdminUser[] }) {
    const [searchQuery, setSearchQuery] = useState('')
    const [planFilter, setPlanFilter] = useState<Plan | 'all'>('all')
    const [sorts, setSorts] = useState<SortRule[]>(DEFAULT_SORT)
    const [page, setPage] = useState(1)
    const [emailUser, setEmailUser] = useState<AdminUser | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        setPage(1)
    }, [searchQuery, planFilter, sorts])

    const filtered = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()

        return users.filter(user => {
            if (planFilter !== 'all' && user.plan !== planFilter) return false
            if (!query) return true

            return (
                user.username.toLowerCase().includes(query) ||
                (user.email?.toLowerCase().includes(query) ?? false) ||
                user.plan.toLowerCase().includes(query)
            )
        })
    }, [users, searchQuery, planFilter])

    const sorted = useMemo(() => sortUsers(filtered, sorts), [filtered, sorts])

    const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
    const currentPage = Math.min(page, pageCount)
    const rows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

    const handlePlanChange = (user: AdminUser, plan: Plan) => {
        if (plan === user.plan) return

        startTransition(async () => {
            try {
                await changeUserPlan(user.id, plan)
                toast.success(`${user.username} is now on ${PLAN_SHORT_LABEL[plan]}`)
            } catch (error) {
                toast.error(
                    error instanceof Error ? error.message : 'Failed to update plan',
                )
            }
        })
    }

    const isFiltered = searchQuery.trim().length > 0 || planFilter !== 'all'

    return (
        <div className='flex flex-col gap-4'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div className='flex flex-1 flex-wrap items-center gap-3'>
                    <Input
                        size='sm'
                        placeholder='Search name, email, or plan'
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                        isClearable
                        onClear={() => setSearchQuery('')}
                        className='w-full max-w-sm'
                        startContent={<PiMagnifyingGlass className='size-4 text-default-400' />}
                    />
                    <Select
                        size='sm'
                        aria-label='Filter by plan'
                        className='w-40'
                        selectedKeys={[planFilter]}
                        onChange={event => setPlanFilter(event.target.value as Plan | 'all')}
                        renderValue={items =>
                            items.map(item => (
                                <span key={String(item.key)}>
                                    {item.key === 'all' ? 'All plans' : PLAN_SHORT_LABEL[item.key as Plan]}
                                </span>
                            ))
                        }
                    >
                        {[
                            <SelectItem key='all'>All plans</SelectItem>,
                            ...PLANS.map(plan => (
                                <SelectItem key={plan}>{PLAN_SHORT_LABEL[plan]}</SelectItem>
                            )),
                        ]}
                    </Select>
                    <SortControl rules={sorts} onChange={setSorts} />
                </div>
                <span className='shrink-0 font-mono text-xs text-default-600 tabular-nums'>
                    {filtered.length.toLocaleString()} of {users.length.toLocaleString()} users
                </span>
            </div>

            <Table
                aria-label='Users'
                shadow='none'
                sortDescriptor={sorts[0]}
                onSortChange={descriptor =>
                    setSorts([
                        {
                            column: descriptor.column as SortKey,
                            direction: descriptor.direction ?? 'ascending',
                        },
                    ])
                }
                classNames={{
                    wrapper: 'p-0 bg-transparent',
                    th: 'bg-transparent text-default-600 font-mono text-[11px] uppercase tracking-wider',
                    td: 'text-sm',
                    tr: 'hover:bg-default-50 transition-colors',
                }}
            >
                <TableHeader>
                    <TableColumn key='username' allowsSorting>
                        USER
                    </TableColumn>
                    <TableColumn key='plan' allowsSorting>
                        PLAN
                    </TableColumn>
                    <TableColumn key='status' allowsSorting>
                        STATUS
                    </TableColumn>
                    <TableColumn key='createdAt' allowsSorting>
                        JOINED
                    </TableColumn>
                    <TableColumn key='lastSignInAt' allowsSorting>
                        LAST SEEN
                    </TableColumn>
                    <TableColumn key='actions' align='end'>
                        {''}
                    </TableColumn>
                </TableHeader>
                <TableBody
                    emptyContent={
                        isFiltered
                            ? 'No users match the current filters'
                            : 'No users yet'
                    }
                >
                    {rows.map(user => (
                        <TableRow key={user.id}>
                            <TableCell>
                                <div className='flex items-center gap-3'>
                                    <Avatar
                                        size='sm'
                                        src={user.avatarUrl ?? undefined}
                                        name={user.username}
                                    />
                                    <div className='flex min-w-0 flex-col'>
                                        <Link
                                            href={`/profile/${user.id}`}
                                            className='truncate text-sm font-medium hover:underline'
                                        >
                                            {user.username}
                                        </Link>
                                        <span className='truncate font-mono text-xs text-default-600'>
                                            {user.email ?? 'No email'}
                                        </span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Select
                                    size='sm'
                                    aria-label={`Plan for ${user.username}`}
                                    className='w-32'
                                    selectedKeys={[user.plan]}
                                    onChange={event =>
                                        handlePlanChange(user, event.target.value as Plan)
                                    }
                                    isDisabled={isPending}
                                    renderValue={items =>
                                        items.map(item => (
                                            <PlanTag
                                                key={String(item.key)}
                                                plan={item.key as Plan}
                                            />
                                        ))
                                    }
                                >
                                    {PLANS.map(plan => (
                                        <SelectItem key={plan} textValue={PLAN_SHORT_LABEL[plan]}>
                                            {PLAN_SHORT_LABEL[plan]}
                                        </SelectItem>
                                    ))}
                                </Select>
                            </TableCell>
                            <TableCell>
                                <span className='inline-flex items-center gap-1.5 text-xs text-default-600'>
                                    {user.emailConfirmedAt ? (
                                        <PiCheckCircleDuotone className='size-3.5 text-secondary-500' />
                                    ) : (
                                        <PiMinusCircleDuotone className='size-3.5 text-default-400' />
                                    )}
                                    {user.emailConfirmedAt ? 'Verified' : 'Unverified'}
                                </span>
                            </TableCell>
                            <TableCell>
                                <span className='font-mono text-xs text-default-600 tabular-nums'>
                                    {formatDate(user.createdAt)}
                                </span>
                            </TableCell>
                            <TableCell>
                                <span className='font-mono text-xs text-default-600 tabular-nums'>
                                    {formatLastSeen(user.lastSignInAt)}
                                </span>
                            </TableCell>
                            <TableCell>
                                <div className='flex justify-end'>
                                    <Dropdown placement='bottom-end'>
                                        <DropdownTrigger>
                                            <Button
                                                isIconOnly
                                                size='sm'
                                                variant='light'
                                                aria-label={`Actions for ${user.username}`}
                                                isDisabled={isPending}
                                            >
                                                <PiDotsThreeVertical className='size-4' />
                                            </Button>
                                        </DropdownTrigger>
                                        <DropdownMenu aria-label={`Actions for ${user.username}`}>
                                            <DropdownItem
                                                key='profile'
                                                as={Link}
                                                href={`/profile/${user.id}`}
                                                startContent={<PiUserDuotone className='size-4' />}
                                            >
                                                View profile
                                            </DropdownItem>
                                            <DropdownItem
                                                key='email'
                                                startContent={
                                                    <PiEnvelopeSimpleDuotone className='size-4' />
                                                }
                                                onPress={() => setEmailUser(user)}
                                            >
                                                Change email
                                            </DropdownItem>
                                            <DropdownItem
                                                key='delete'
                                                color='danger'
                                                className='text-danger'
                                                startContent={<PiTrashDuotone className='size-4' />}
                                                onPress={() => setDeleteTarget(user)}
                                            >
                                                Delete user
                                            </DropdownItem>
                                        </DropdownMenu>
                                    </Dropdown>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {pageCount > 1 && (
                <div className='flex justify-center pt-1'>
                    <Pagination
                        size='sm'
                        total={pageCount}
                        page={currentPage}
                        onChange={setPage}
                        showControls
                        classNames={{ cursor: 'font-mono' }}
                    />
                </div>
            )}

            <EditEmailModal user={emailUser} onClose={() => setEmailUser(null)} />
            <DeleteUserModal user={deleteTarget} onClose={() => setDeleteTarget(null)} />
        </div>
    )
}

export function UserTableSkeleton() {
    return (
        <div className='flex flex-col gap-4'>
            <div className='flex items-center gap-3'>
                <div className='h-8 w-64 animate-pulse rounded-xl bg-default-100' />
                <div className='h-8 w-40 animate-pulse rounded-xl bg-default-100' />
            </div>
            <div className='flex flex-col gap-2'>
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={index}
                        className={cn(
                            'flex items-center gap-3 rounded-xl bg-default-50 p-3',
                            index === 0 && 'opacity-60',
                        )}
                    >
                        <div className='size-8 animate-pulse rounded-full bg-default-100' />
                        <div className='flex flex-1 flex-col gap-1.5'>
                            <div className='h-3 w-40 animate-pulse rounded-full bg-default-100' />
                            <div className='h-2.5 w-56 animate-pulse rounded-full bg-default-100' />
                        </div>
                        <div className='h-6 w-24 animate-pulse rounded-full bg-default-100' />
                    </div>
                ))}
            </div>
        </div>
    )
}
