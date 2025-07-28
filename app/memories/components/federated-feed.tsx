'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { getFederatedMemoriesAction } from '../actions'
import { useIntersectionObserver } from 'usehooks-ts'
import { useEffect } from 'react'
import { FeedSkeleton } from './feed-skeleton'
import { MemoryCard } from './memory-card'
import { Spinner } from '@heroui/spinner'

export function FederatedFeed() {
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useInfiniteQuery({
        queryKey: ['federated-memories'],
        queryFn: ({ pageParam = 1 }) => getFederatedMemoriesAction({ page: pageParam, size: 10 }),
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length ? allPages.length + 1 : undefined
        },
        initialPageParam: 1,
    })

    const { ref, isIntersecting } = useIntersectionObserver({
        threshold: 0.1,
    })

    useEffect(() => {
        if (isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
        }
    }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage])

    if (isLoading) {
        return <FeedSkeleton />
    }

    const memories = data?.pages.flatMap(page => page) ?? []

    return (
        <div className='space-y-4'>
            {memories.map(memory => (
                <MemoryCard key={memory.id} memory={memory} />
            ))}
            <div ref={ref} className='flex justify-center p-3'>
                {isFetchingNextPage && <Spinner color='default' />}
            </div>
        </div>
    )
}