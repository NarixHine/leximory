'use client'

import { Skeleton } from '@heroui/react'
import FlatCard from '@/components/ui/flat-card'

export function FeedSkeleton() {
    return (
        <div className='space-y-4 w-full'>
            {[...Array(3)].map((_, i) => (
                <FlatCard background='solid' key={i} fullWidth className='p-6'>
                    <div className='flex items-center justify-between gap-36'>
                        <div className='flex items-center gap-3'>
                            <Skeleton className='size-10 rounded-full' />
                            <div className='space-y-2'>
                                <Skeleton className='h-3 w-24 rounded-lg' />
                                <Skeleton className='h-3 w-16 rounded-lg' />
                            </div>
                        </div>
                        <Skeleton className='size-8 rounded-full' />
                    </div>
                    <div className='space-y-2 mt-4'>
                        <Skeleton className='h-4 w-full rounded-lg' />
                        <Skeleton className='h-4 w-3/4 rounded-lg' />
                    </div>
                </FlatCard>
            ))}
        </div>
    )
}