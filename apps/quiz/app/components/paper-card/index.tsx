'use client'

import { Card, CardHeader, CardBody, Avatar, Skeleton } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { getUserProfileAction } from '@repo/service/user'
import Link from 'next/link'

export function PaperCard({
    id,
    title,
    tags,
    uid,
    createdAt
}: {
    id: number
    title: string
    tags: string[]
    uid: string
    createdAt: string
}) {
    const { data: user, isSuccess } = useQuery({
        queryKey: ['user', uid],
        queryFn: async () => {
            const { data } = await getUserProfileAction({ id: uid })
            return data
        },
    })

    return (
        <Card shadow='none' className='border border-default p-3 hover:border-default-300 transition-all duration-200 ease-in-out' isPressable as={Link} href={`/paper/${id}`}>
            <CardHeader className='flex flex-col items-start'>
                <Skeleton isLoaded={isSuccess} className='h-5 rounded-2xl min-w-20 mb-2'>
                    <div className='flex gap-3 text-default-600 text-lg items-center'>
                        <span className='font-mono text-ellipsis overflow-hidden whitespace-nowrap max-w-40'>{user?.name}</span>
                        <Avatar src={user?.imageUrl} className='size-5' />
                    </div>
                </Skeleton>
                <h3 className='text-3xl font-formal'>{title}</h3>
                <div className='font-mono text-default-400'>{createdAt}</div>
            </CardHeader>
            <CardBody className='px-3 pb-2 pt-0'>
                <div className='font-mono text-sm text-default-400'>
                    {tags.map((tag, idx) => (<span key={idx} className='not-last:after:content-["\00B7"] after:mx-1'>
                        <span>
                            {tag}
                        </span>
                    </span>
                    ))}
                </div>
            </CardBody>
        </Card>
    )
}

export function PaperCardSkeleton() {
    return (
        <Card shadow='none' className='border border-default p-3 opacity-50'>
            <CardHeader className='flex flex-col items-start'>
                <Skeleton className='h-3 mb-2 rounded-2xl'>
                    <div className='flex gap-2 text-default-600 text-lg items-center mb-2'>
                        <span className='font-mono'>Placeholder Name</span>
                        <div className='size-5 rounded-full bg-default-200' />
                    </div>
                </Skeleton>
                <Skeleton className='h-5 mb-6 rounded-lg'>
                    <h3 className='text-3xl italic'>Placeholder Title</h3>
                </Skeleton>
            </CardHeader>
            <CardBody className='px-3 pb-2'>
                <Skeleton className='h-3 mb-3 rounded-lg overflow-clip'>
                    <div className='font-mono text-default-400'>Tag1 · Tag2 · Tag3</div>
                </Skeleton>
                <Skeleton className='h-3 rounded-lg overflow-clip'>
                    <div className='font-mono text-default-400'>2023-01-01</div>
                </Skeleton>
            </CardBody>
        </Card>
    )
}