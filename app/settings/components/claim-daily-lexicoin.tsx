'use client'

import { Button } from '@heroui/button'
import { PiPiggyBankDuotone } from 'react-icons/pi'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { toast } from 'sonner'
import { getDailyLexicoin } from '../actions'
import { cn } from '@/lib/utils'
import { useTransition } from 'react'

export const ClaimDailyLexicoin = ({ hasClaimed }: { hasClaimed: boolean }) => {
    const [isPending, startTransition] = useTransition()
    return <Button
        fullWidth
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
        className={cn(CHINESE_ZCOOL.className, 'text-lg')}
        isDisabled={hasClaimed}
    >
        {hasClaimed ? '今日已领取' : '领取每日 LexiCoin'}
    </Button>
}


