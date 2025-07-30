'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { Button } from '@heroui/button'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { Spinner } from '@heroui/spinner'
import { momentSH } from '@/lib/moment'
import Link from 'next/link'
import { PiPencilDuotone } from 'react-icons/pi'
import { Image } from '@heroui/image'
import { fetchMoreIssues } from '@/components/times/actions'
import { useIntersectionObserver } from 'usehooks-ts'
import { useEffect } from 'react'
import { TIMES_PAGE_SIZE } from '@/lib/config'

export default function AdminTimesPage() {
    const { isIntersecting, ref } = useIntersectionObserver({
        threshold: 0.1
    })

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        error
    } = useInfiniteQuery({
        queryKey: ['admin-times'],
        queryFn: ({ pageParam = 1 }) => fetchMoreIssues(pageParam),
        getNextPageParam: (lastPage, allPages) =>
            lastPage.hasMore ? allPages.flatMap(page => page.data).length / TIMES_PAGE_SIZE + 1 : undefined,
        initialPageParam: 1,
    })

    useEffect(() => {
        if (isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
        }
    }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage])

    if (isLoading) {
        return (
            <div className='container mx-auto p-6 max-w-4xl'>
                <div className='mb-6'>
                    <h1 className='text-2xl font-bold mb-2'>Times Management</h1>
                    <p className='text-default-600'>
                        Manage and edit Leximory Times issues
                    </p>
                </div>
                <div className='flex justify-center items-center py-12'>
                    <Spinner size='lg' />
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className='container mx-auto p-6 max-w-4xl'>
                <div className='mb-6'>
                    <h1 className='text-2xl font-bold mb-2'>Times Management</h1>
                    <p className='text-default-600'>
                        Manage and edit Leximory Times issues
                    </p>
                </div>
                <div className='text-center py-12'>
                    <p className='text-danger text-lg'>Failed to load Times issues. Please try again.</p>
                </div>
            </div>
        )
    }

    const allIssues = data?.pages.flatMap(page => page.data) || []

    return (
        <div className='container mx-auto p-6 max-w-4xl'>
            <div className='mb-6'>
                <h1 className='text-2xl font-bold mb-2'>Times Management</h1>
                <p className='text-default-600'>
                    Manage and edit Leximory Times issues
                </p>
            </div>

            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                {allIssues.map((issue) => (
                    <Card key={issue.date} shadow='sm'>
                        <CardHeader className='pb-2'>
                            <div className='flex justify-between items-start w-full'>
                                <div>
                                    <h3 className='font-semibold'>
                                        {momentSH(issue.date).format('MMM DD, YYYY')}
                                    </h3>
                                    <p className='text-sm text-default-500'>
                                        {momentSH(issue.date).format('dddd')}
                                    </p>
                                </div>
                                <Button
                                    as={Link}
                                    href={`/admin/times/${issue.date}`}
                                    size='sm'
                                    color='primary'
                                    variant='light'
                                    startContent={<PiPencilDuotone />}
                                >
                                    Edit
                                </Button>
                            </div>
                        </CardHeader>
                        <CardBody className='pt-0'>
                            <div className='relative w-full aspect-video rounded-lg overflow-hidden'>
                                <Image
                                    src={issue.cover}
                                    alt={`Cover for ${issue.date}`}
                                    className='object-cover'
                                />
                            </div>
                        </CardBody>
                    </Card>
                ))}
            </div>

            {/* Infinite scroll trigger */}
            {hasNextPage && (
                <div className='flex justify-center py-8'>
                    <Spinner ref={ref} size='lg' />
                </div>
            )}

            {allIssues.length === 0 && (
                <div className='text-center py-12'>
                    <p className='text-default-500 text-lg'>No Times issues found.</p>
                </div>
            )}
        </div>
    )
}
