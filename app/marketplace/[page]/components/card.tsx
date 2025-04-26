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
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { Chip } from '@heroui/chip'

interface LibraryCardProps {
    library: {
        id: string
        owner: string
        name: string
        lang: Lang
        price: number
    }
    isStarred: boolean
    avatar: ReactNode
    hideAvatar?: boolean
}

export default function LibraryCard({ library, isStarred, avatar, hideAvatar }: LibraryCardProps) {
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
            <CardBody className='p-5 pb-0'>
                <div className='space-y-1'>
                    <H useNoto disableCenter className='text-2xl '>{library.name}</H>
                    <Chip variant='flat' color='primary' className='text-sm opacity-70'>{langMap[library.lang]}</Chip>
                </div>
            </CardBody>

            <CardFooter className='flex justify-end gap-3 pb-4 pr-4'>
                <Button
                    as={'div'}
                    size='sm'
                    isDisabled={isStarred}
                    isLoading={isTransitioning}
                    startContent={isTransitioning ? null : <PiCoinsDuotone className='size-5' />}
                    color='primary'
                    variant={'ghost'}
                    className={CHINESE_ZCOOL.className}
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
                {!hideAvatar && avatar}
            </CardFooter>
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
