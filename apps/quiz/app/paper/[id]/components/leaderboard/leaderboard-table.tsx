'use client'

import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/react'
import { Avatar } from '@heroui/avatar'
import { Button } from '@heroui/button'
import { TrophyIcon, UserIcon } from '@phosphor-icons/react'
import { cn } from '@heroui/theme'
import moment from 'moment'
import { Logo } from '@/components/logo'

type User = {
    userId: string
    email: string
    username: string | undefined
    image: string | undefined
    lastActiveAt: string
    createdAt: string
}

type SubmissionWithUser = {
    rank: number
    score: number
    perfectScore: number
    userId: string
    userName: string | undefined
    userImage: string | undefined
    createdAt: string
}

type LeaderboardTableProps = {
    leaderboardData: SubmissionWithUser[]
    currentUser: User | null
    currentUserRank: number | null
}

function getRankIcon(rank: number) {
    if (rank === 1) {
        return <TrophyIcon weight='fill' className='text-yellow-400' size={20} />
    }
    if (rank === 2) {
        return <TrophyIcon weight='fill' className='text-gray-300 dark:text-gray-600' size={20} />
    }
    if (rank === 3) {
        return <TrophyIcon weight='fill' className='text-amber-600' size={20} />
    }
    return null
}

function getRankColor(rank: number) {
    if (rank === 1) return 'text-yellow-400'
    if (rank === 2) return 'text-gray-300'
    if (rank === 3) return 'text-amber-600'
    return 'text-default-500'
}

export function LeaderboardTable({ leaderboardData, currentUser, currentUserRank }: LeaderboardTableProps) {
    const handleJumpToUser = () => {
        if (!currentUser) return
        const element = document.getElementById(`user-row-${currentUser.userId}`)
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }

    if (leaderboardData.length === 0) {
        return (
            <div className='flex flex-col items-center justify-center py-16 text-default-600'>
                <Logo className='size-12' />
                <p className='mt-4 text-xl'>榜上无人</p>
                <p className='text-sm mt-1'>成为第一个解出此谜的人吧</p>
            </div>
        )
    }

    return (
        <div className='flex flex-col gap-4'>
            {currentUserRank && currentUserRank > 0 && (
                <div className='flex justify-end'>
                    <Button
                        size='sm'
                        color='primary'
                        startContent={<UserIcon weight='bold' />}
                        onPress={handleJumpToUser}
                    >
                        跳转到我的排名
                    </Button>
                </div>
            )}

            <Table
                removeWrapper
                hideHeader
                aria-label='排行榜'
                classNames={{
                    tbody: 'divide-y divide-divider',
                }}
            >
                <TableHeader>
                    <TableColumn>排名</TableColumn>
                    <TableColumn>用户</TableColumn>
                    <TableColumn>分数</TableColumn>
                </TableHeader>
                <TableBody
                    items={leaderboardData}
                    emptyContent='暂无数据'
                >
                    {(item) => (
                        <TableRow
                            key={item.userId}
                            id={currentUser && item.userId === currentUser.userId ? `user-row-${currentUser.userId}` : undefined}
                            className={cn(
                                'group',
                                currentUser && item.userId === currentUser.userId && 'bg-primary-50/50'
                            )}
                        >
                            <TableCell className='w-16 py-4'>
                                <div className='flex items-center justify-center'>
                                    {getRankIcon(item.rank) || (
                                        <span className={cn('text-sm font-medium', getRankColor(item.rank))}>
                                            #{item.rank}
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className='py-4'>
                                <div className='flex items-center gap-3'>
                                    <Avatar
                                        src={item.userImage}
                                        name={item.userName}
                                        size='sm'
                                        radius='md'
                                        className='shrink-0'
                                    />
                                    <div className='flex flex-col'>
                                        <span className='text-sm font-medium text-foreground'>
                                            {item.userName || '匿名用户'}
                                        </span>
                                        <span className='text-xs text-default-400'>
                                            {moment(item.createdAt).fromNow()}
                                        </span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className='py-4 text-right'>
                                <div className='flex justify-end items-end pr-4'>
                                    <span className='text-xl font-bold text-primary mr-1'>
                                        {item.score} 
                                    </span>
                                    <span className='text-sm text-default-400'>
                                        / {item.perfectScore}
                                    </span>
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
