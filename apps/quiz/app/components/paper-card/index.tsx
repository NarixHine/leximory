'use client'

import { Card, CardHeader, CardBody, Avatar, Skeleton } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { getUserProfileAction } from '@repo/service/user'

export function PaperCard({
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
        <Card shadow='none' className='border border-default p-3'>
            <CardHeader className='flex flex-col items-start'>
                <Skeleton isLoaded={false} className='h-5 mb-2 rounded-2xl'>
                    <div className='flex gap-2 text-default-500 items-center mb-2'>
                        <span className='font-mono'>{user?.name}</span>
                        <Avatar src={user?.imageUrl} className='size-5' />
                    </div>
                </Skeleton>
                <h3 className='text-3xl italic'>{title}</h3>
            </CardHeader>
            <CardBody className='px-3 pb-2'>
                <div className='font-mono text-default-400'>
                    {tags.map(tag => (<span key={tag} className='not-last:after:content-["\00B7"] after:mx-1'>
                        <span>
                            {tag}
                        </span>
                    </span>
                    ))}
                </div>
                <div className='font-mono text-default-400'>{createdAt}</div>
            </CardBody>
        </Card>
    )
}