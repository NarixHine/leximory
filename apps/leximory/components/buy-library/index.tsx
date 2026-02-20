'use client'

import { star } from '@/app/library/[lib]/components/actions'
import { cn } from '@/lib/utils'
import { Avatar } from '@heroui/avatar'
import { Button, ButtonProps } from '@heroui/react'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useState, useTransition } from 'react'
import { PiCheckCircle, PiCoins } from 'react-icons/pi'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/** Purchase button with an overlapping owner avatar. */
export default function BuyLibrary({ price, id, isStarred, navigateAfterPurchase, uid, isOwner, ...props }: {
    price: number
    id: string
    isStarred: boolean
    navigateAfterPurchase?: boolean
    /** Owner user ID — used to fetch avatar client-side. */
    uid: string
    isOwner?: boolean
} & ButtonProps) {
    const router = useRouter()
    const [isTransitioning, startTransition] = useTransition()
    const { data: user, isSuccess } = useUserProfile(uid)

    return <div className={'flex items-center'}>
        <Button
            as={'div'}
            size='sm'
            isDisabled={isStarred || isOwner}
            isLoading={isTransitioning}
            startContent={isTransitioning ? null : (isStarred ? <PiCheckCircle className='size-5' /> : <PiCoins className='size-5' />)}
            color='primary'
            className={cn('-mr-5 pr-7 rounded-l-3xl')}
            onPress={() => {
                startTransition(async () => {
                    const { success, message } = await star(id)
                    if (success) {
                        toast.success('购入成功')
                        if (navigateAfterPurchase) {
                            router.push(`/library/${id}`)
                        }
                    }
                    else {
                        toast.error(message)
                    }
                })
            }}
            {...props}
        >
            {
                isStarred
                    ? '已购买'
                    : price === 0
                        ? '免费'
                        : <span><span className='font-mono text-base'>{price}</span> LexiCoin 购入</span>
            }
        </Button>
        <Button
            startContent={
                <Avatar
                    src={isSuccess ? user?.imageUrl ?? undefined : undefined}
                    size='sm'
                    className={!isSuccess ? 'animate-pulse' : ''}
                />}
            as={Link}
            href={`/profile/${uid}`}
            isIconOnly
            radius='full'
        />
    </div>
}   
