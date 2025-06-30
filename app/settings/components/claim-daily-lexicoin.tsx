'use client'

import { Button } from '@heroui/button'
import { PiPiggyBankDuotone } from 'react-icons/pi'
import { toast } from 'sonner'
import { getDailyLexicoin } from '../actions'
import { useTransition } from 'react'

export const ClaimDailyLexicoin = ({ hasClaimed }: { hasClaimed: boolean }) => {
    const [isPending, startTransition] = useTransition()
    return <Button
        isLoading={isPending}
        startContent={<PiPiggyBankDuotone />}
        onPress={async () => {
            startTransition(async () => {
                const { message } = await getDailyLexicoin()
                toast.success(message)
            })
        }}
        variant='ghost'
        color='primary'
        radius='full'
        size='lg'
        className={'text-lg flex-1 font-semibold'}
        isDisabled={hasClaimed}
    >
        {hasClaimed ? '今日已领取' : '领取每日 LexiCoin'}
    </Button>
}


