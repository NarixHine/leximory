'use client'

import FlatCard from '@/components/ui/flat-card'
import StoneSkeleton from '@/components/ui/stone-skeleton'

export function FeedSkeleton() {
    return (
        <div className='space-y-4 w-full'>
            {[...Array(3)].map((_, i) => (
                <FlatCard background='solid' key={i} fullWidth className='p-6 bg-stone-400/10 dark:bg-stone-700/30 border-none'>
                    <div className='flex items-center gap-3'>
                        <StoneSkeleton className='size-10 rounded-full' />
                        <div className='space-y-2'>
                            <StoneSkeleton className='h-3 w-40 rounded-lg' />
                            <StoneSkeleton className='h-3 w-24 rounded-lg' />
                        </div>
                    </div>
                    <div className='space-y-4 mt-4'>
                        <StoneSkeleton className='h-3 w-full rounded-lg' />
                        <StoneSkeleton className='h-3 w-3/4 rounded-lg' />
                        <StoneSkeleton className='h-3 w-full rounded-lg' />
                        <StoneSkeleton className='h-3 w-3/4 rounded-lg' />
                        <StoneSkeleton className='h-3 w-full rounded-lg' />
                        <StoneSkeleton className='h-3 w-3/4 rounded-lg' />
                    </div>
                </FlatCard>
            ))}
        </div>
    )
}