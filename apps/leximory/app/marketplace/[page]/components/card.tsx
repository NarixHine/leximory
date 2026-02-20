'use client'

import { Lang } from '@repo/env/config'
import { ReactNode } from 'react'
import BuyLibrary from '@/components/buy-library'
import LibraryCardBase from '@/components/library-card'

interface LibraryCardProps {
    library: {
        id: string
        owner: string
        name: string
        lang: Lang
        price: number
        readers?: number
    }
    isStarred: boolean
    avatar: ReactNode
    hideFooter?: boolean
    isOwner: boolean
}

export default function LibraryCard({ library, isStarred, avatar, hideFooter, isOwner }: LibraryCardProps) {
    return (
        <LibraryCardBase
            id={library.id}
            name={library.name}
            lang={library.lang}
            owner={library.owner}
            footer={!hideFooter ? <>
                {typeof library.readers === 'number' && (
                    <div className='text-default-400 text-xs'>
                        <span className='font-mono text-sm'>{library.readers}</span> 个读者
                    </div>
                )}
                {!library.readers && <div />}
                <BuyLibrary
                    isStarred={isStarred}
                    id={library.id}
                    price={library.price}
                    avatar={avatar}
                    isOwner={isOwner}
                />
            </> : undefined}
        />
    )
}

export function LibraryCardSkeleton() {
    return (
        <div className='break-inside-avoid rounded-3xl bg-default-50 p-3.5 animate-pulse'>
            <div className='rounded-2xl bg-default-100 px-6 pb-7 pt-5'>
                <div className='mb-3 h-5 w-32 rounded-xl bg-default-200' />
                <div className='mb-2 h-4 w-16 rounded bg-default-200' />
                <div className='h-8 w-3/4 rounded-lg bg-default-200' />
            </div>
            <div className='flex items-center justify-end px-2 pt-2'>
                <div className='h-8 w-24 rounded-xl bg-default-200' />
            </div>
        </div>
    )
}
