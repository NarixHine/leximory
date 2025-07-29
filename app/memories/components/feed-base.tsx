'use client'

import { useInfiniteQuery, QueryKey } from '@tanstack/react-query'
import { useIntersectionObserver } from 'usehooks-ts'
import { useEffect } from 'react'
import { FeedSkeleton } from './feed-skeleton'
import { MemoryCard } from './memory-card'
import { Spinner } from '@heroui/spinner'
import H from '@/components/ui/h'

type FetchMemoriesFn<T> = ({ pageParam }: { pageParam: number }) => Promise<T[]>

interface FeedBaseProps<T> {
    queryKey: QueryKey
    fetchMemories: FetchMemoriesFn<T & { id: number, creator: any }>
    showTitle?: boolean
}

export function FeedBase<T>({ queryKey, fetchMemories, showTitle }: FeedBaseProps<T>) {
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam = 1 }) => fetchMemories({ pageParam }),
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
        return <div className='space-y-4'>
            {showTitle && <H fancy className='text-3xl font-semibold'>Memories</H>}
            <FeedSkeleton />
        </div>
    }

    const memories = data?.pages.flatMap(page => page) ?? []

    return (
        <div className='space-y-4'>
            {showTitle && memories.length > 0 && <H fancy className='text-3xl font-semibold'>Memories</H>}
            {memories.map(memory => (
                <MemoryCard key={memory.id} memory={memory as any} />
            ))}
            <div ref={ref} className='flex justify-center p-3'>
                {isFetchingNextPage && <Spinner variant='wave' color='default' />}
            </div>
        </div>
    )
}