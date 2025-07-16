'use client'

import { Lang } from '@/lib/config'
import { getLanguageStrategy } from '@/lib/languages'
import { CardBody, CardFooter } from "@heroui/card"
import H from '@/components/ui/h'
import { useRouter } from 'next/navigation'
import { ReactNode } from 'react'
import { Skeleton } from "@heroui/skeleton"
import { cn } from '@/lib/utils'
import { Spacer } from '@heroui/spacer'
import BuyLibrary from '@/components/buy-library'
import FlatCard from '@/components/ui/flat-card'

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
    const router = useRouter()

    return (
        <FlatCard
            background='solid'
            onPress={() => {
                router.push(`/library/${library.id}`)
            }}
            isPressable
        >
            <CardBody className={cn('p-5', !hideFooter && 'pb-0')}>
                <div className='flex flex-col'>
                    <H disableCenter className='text-2xl'>{library.name}</H>
                    <Spacer y={1} />
                    <span className={cn('text-sm opacity-60')}>语言：{getLanguageStrategy(library.lang).name}</span>
                    {library.readers && (
                        <span className={cn('text-sm opacity-60')}>读者：{library.readers} 人</span>
                    )}
                </div>
            </CardBody>

            {!hideFooter && <CardFooter className='flex justify-end pb-4 pr-4'>
                <BuyLibrary
                    isStarred={isStarred}
                    id={library.id}
                    price={library.price}
                    avatar={avatar}
                    isOwner={isOwner}
                />
            </CardFooter>}
        </FlatCard>
    )
}

export function LibraryCardSkeleton() {
    return (
        <FlatCard
            background='solid'
        >
            <CardBody className='p-5'>
                <div className='space-y-4'>
                    <Skeleton className='rounded-lg h-8 w-3/4' />
                    <Skeleton className='rounded-lg h-4 w-1/3' />
                    <Skeleton className='rounded-lg h-4 w-1/3' />
                </div>
            </CardBody>

            <CardFooter className='flex justify-end pb-4 pr-4'>
                <Skeleton className='rounded-lg h-6 w-20 -mr-2' />
                <Skeleton className='rounded-full size-10' />
            </CardFooter>
        </FlatCard>
    )
}
