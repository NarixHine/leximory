'use client'

import { Lang, langMap } from '@/lib/config'
import { PiCoinsDuotone } from 'react-icons/pi'
import { Card, CardBody, CardFooter } from "@heroui/card"
import { Button } from "@heroui/button"
import H from '@/components/ui/h'
import { useRouter } from 'next/navigation'
import { ReactNode, useTransition } from 'react'
import { Skeleton } from "@heroui/skeleton"
import { star } from '@/app/library/[lib]/components/actions'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Spacer } from '@heroui/spacer'

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
    const [isTransitioning, startTransition] = useTransition()

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
                    <span className={cn('text-sm opacity-60')}>语言：{langMap[library.lang]}</span>
                    <span className={cn('text-sm opacity-60')}>读者：{library.readers} 人</span>
                </div>
            </CardBody>

            {!hideFooter && <CardFooter className='flex justify-end pb-4 pr-4'>
                <Button
                    as={'div'}
                    size='sm'
                    isDisabled={isStarred}
                    isLoading={isTransitioning}
                    startContent={isTransitioning ? null : <PiCoinsDuotone className='size-5' />}
                    color='primary'
                    variant={'flat'}
                    className={cn('-mr-5 pr-7')}
                    onPress={() => {
                        startTransition(async () => {
                            const { success, message } = await star(library.id)
                            if (success) {
                                toast.success('钉选成功')
                            }
                            else {
                                toast.error(message)
                            }
                        })
                    }}
                >
                    {
                        isStarred
                            ? '已购买'
                            : library.price === 0
                                ? '免费'
                                : `用 ${library.price} LexiCoin 购买`
                    }
                </Button>
                {avatar}
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
