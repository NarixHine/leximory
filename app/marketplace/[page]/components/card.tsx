'use client'

import { Lang, langMap } from '@/lib/config'
import { PiPushPinDuotone, PiPushPinFill } from 'react-icons/pi'
import { Card, CardBody, CardFooter } from "@heroui/card"
import { Button } from "@heroui/button"
import H from '@/components/ui/h'
import { useRouter } from 'next/navigation'
import { ReactNode, useTransition } from 'react'
import { Skeleton } from "@heroui/skeleton"
import { star } from '@/app/library/[lib]/components/actions'
import { useLogSnag } from '@logsnag/next'

interface LibraryCardProps {
    library: {
        id: string
        owner: string
        name: string
        lang: Lang
    }
    isStarred: boolean
    avatar: ReactNode
}

export default function LibraryCard({ library, isStarred, avatar }: LibraryCardProps) {
    const router = useRouter()
    const [isTransitioning, startTransition] = useTransition()
    const { track } = useLogSnag()

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
                    <p className='text-sm opacity-70'>{langMap[library.lang]}</p>
                </div>
            </CardBody>

            <CardFooter className='flex justify-end gap-3 pb-4 pr-4'>
                {avatar}
                <Button
                    as={'div'}
                    size='sm'
                    isLoading={isTransitioning}
                    startContent={isStarred ? <PiPushPinFill className='text-lg' /> : <PiPushPinDuotone className='text-lg' />}
                    color='primary'
                    variant={'ghost'}
                    onPress={() => {
                        track({
                            event: isStarred ? '取消钉选文库' : '钉选文库',
                            channel: 'resource-sharing',
                            icon: '📍',
                            description: `${isStarred ? '取消' : ''}钉选了 ${library.name}`,
                            tags: { lib: library.id, lang: library.lang }
                        })
                        startTransition(() => {
                            star(library.id)
                        })
                    }}
                >
                </Button>
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
                    <Skeleton className='rounded-lg h-2 w-1/3' />
                </div>
            </CardBody>

            <CardFooter className='flex justify-end gap-2 pb-4 pr-4'>
                <Skeleton className='rounded-full size-7' />
                <Skeleton className='rounded-lg h-6 w-16' />
            </CardFooter>
        </Card>
    )
}
