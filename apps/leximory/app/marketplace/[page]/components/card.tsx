'use client'

import { Lang } from '@/lib/config'
import { getLanguageStrategy } from '@/lib/languages'
import { CardBody, CardFooter } from "@heroui/card"
import H from '@/components/ui/h'
import { useRouter } from 'next/navigation'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import BuyLibrary from '@/components/buy-library'
import FlatCard from '@/components/ui/flat-card'
import StoneSkeleton from '@/components/ui/stone-skeleton'
import { Chip } from '@heroui/chip'

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
            <CardBody className={cn('p-5 pt-4', !hideFooter && 'pb-0')}>
                <div className='flex flex-col'>
                    <H disableCenter className='text-2xl'>{library.name}</H>
                    {typeof library.readers === 'number' && (<div className='text-default-600'>
                        <span className={cn('text-lg')}>{library.readers}</span> <span className={cn('text-xs')}>个读者</span>
                    </div>)}
                </div>
            </CardBody>

            {!hideFooter && <CardFooter className='flex pb-3 pr-4'>
                <Chip variant='dot' color='primary' size='sm' className={cn('border-0 text-medium')}>{getLanguageStrategy(library.lang).emoji}</Chip>
                <div className='flex-1'></div>
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
                    <StoneSkeleton className='rounded-lg h-8 w-3/4' />
                    <StoneSkeleton className='rounded-lg h-4 w-1/3' />
                    <StoneSkeleton className='rounded-lg h-4 w-1/3' />
                </div>
            </CardBody>

            <CardFooter className='flex justify-end pb-4 pr-4'>
                <StoneSkeleton className='rounded-lg'>
                    <BuyLibrary
                        isStarred={true}
                        id={''}
                        price={0}
                        avatar={''}
                        isOwner={true}
                    />
                </StoneSkeleton>
            </CardFooter>
        </FlatCard>
    )
}
