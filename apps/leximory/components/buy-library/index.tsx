'use client'

import { star } from '@/app/library/[lib]/components/actions'
import { cn } from '@/lib/utils'
import { Button } from '@heroui/react'
import { useTransition, ReactNode } from 'react'
import { PiCoinsDuotone } from 'react-icons/pi'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function BuyLibrary({ price, id, isStarred, navigateAfterPurchase, avatar, isOwner }: {
    price: number
    id: string
    isStarred: boolean,
    navigateAfterPurchase?: boolean
    avatar: ReactNode,
    isOwner?: boolean
}) {
    const router = useRouter()
    const [isTransitioning, startTransition] = useTransition()

    return <div className={'flex items-center'}>
        <Button
            as={'div'}
            size='sm'
            isDisabled={isStarred || isOwner}
            isLoading={isTransitioning}
            startContent={isTransitioning ? null : <PiCoinsDuotone className='size-5' />}
            color='primary'
            className={cn('-mr-5 pr-7')}
            onPress={() => {
                startTransition(async () => {
                    const { success, message } = await star(id)
                    if (success) {
                        toast.success('钉选成功')
                        if (navigateAfterPurchase) {
                            router.push(`/library/${id}`)
                        }
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
                    : price === 0
                        ? '免费'
                        : <span><span className='font-mono text-base'>{price}</span> LexiCoin</span>
            }
        </Button>
        {avatar}
    </div>
}   
