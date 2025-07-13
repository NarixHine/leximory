'use client'

import { Lang } from '@/lib/config'
import { getLanguageStrategy } from '@/lib/languages'
import { Card, CardBody, CardFooter } from "@heroui/card"
import H from '@/components/ui/h'
import { useRouter } from 'next/navigation'
import { ReactNode } from 'react'
import { Skeleton } from "@heroui/skeleton"
import { cn } from '@/lib/utils'
import { Spacer } from '@heroui/spacer'
import BuyLibrary from '@/components/buy-library'

interface LibraryCardProps {
    library: {
        id: string
        owner: string
        name: string
        lang: Lang
        price: number
        readers: number
    }
    isStarred: boolean
    avatar: ReactNode
    hideFooter?: boolean
}

export default function LibraryCard({ library, isStarred, avatar, hideFooter }: LibraryCardProps) {
    const router = useRouter()

    return (
        <Card
            shadow='sm'
            radius='sm'
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
                    <span className={cn('text-sm opacity-60')}>读者：{library.readers} 人</span>
                </div>
            </CardBody>

            {!hideFooter && <CardFooter className='flex justify-end pb-4 pr-4'>
                <BuyLibrary
                    isStarred={isStarred}
                    id={library.id}
                    price={library.price}
                    avatar={avatar}
                />
            </CardFooter>}
        </Card>
    )
}

export function LibraryCardSkeleton() {
    return (
        <Card
            shadow='sm'
            radius='sm'
        >
            <CardBody className='p-5'>
                <div className='space-y-2'>
                    <Skeleton className='rounded-lg h-8 w-3/4' />
                    <Skeleton className='rounded-lg h-6 w-1/3' />
                </div>
            </CardBody>

            <CardFooter className='flex justify-end gap-2 pb-4 pr-4'>
                <Skeleton className='rounded-full size-7' />
                <Skeleton className='rounded-lg h-6 w-16' />
            </CardFooter>
        </Card>
    )
}
