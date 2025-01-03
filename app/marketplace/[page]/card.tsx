'use client'

import { Lang, langMap } from '@/lib/config'
import { PiPushPinDuotone, PiPushPinFill } from 'react-icons/pi'
import { Card, CardBody, CardFooter } from '@nextui-org/card'
import { Button } from '@nextui-org/button'
import H from '@/components/h'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import star from '@/app/library/[lib]/actions'

interface LibraryCardProps {
    library: {
        id: string
        name: string
        lang: Lang
    }
    isStarred: boolean
}

export default function LibraryCard({ library, isStarred }: LibraryCardProps) {
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
            <CardBody className='p-5'>
                <div className='space-y-1'>
                    <H useNoto disableCenter className='text-2xl text-gray-800'>{library.name}</H>
                    <p className='text-sm text-gray-500'>{langMap[library.lang]}</p>
                </div>
            </CardBody>

            <CardFooter className='flex justify-end pb-4 pr-4'>
                <Button
                    as={'div'}
                    size='sm'
                    isLoading={isTransitioning}
                    startContent={isStarred ? <PiPushPinFill className='text-lg' /> : <PiPushPinDuotone className='text-lg' />}
                    color='secondary'
                    variant={'ghost'}
                    onPress={() => {
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
