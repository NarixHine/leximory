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
        className={'text-lg flex-1'}
        isDisabled={hasClaimed}
    >
        {hasClaimed ? <span>今日已领取</span> : <span>领取<span className='hidden sm:inline'>每日 LexiCoin</span><span className='inline sm:hidden'>余额</span></span>}
    </Button>
}


