'use client'

import { CircularProgress, cn, Switch } from "@heroui/react"
import { useAtom } from 'jotai'
import { accentAtom } from '../atoms'
import { PiCoffeeDuotone, PiHamburgerDuotone } from 'react-icons/pi'
import { useTransition } from 'react'
import { setPreference } from '../actions'
import { CHINESE_ZCOOL } from '@/lib/fonts'

export default function Preference() {
    const [accent, setAccent] = useAtom(accentAtom)
    const [isUpdating, startUpdating] = useTransition()
    return <Switch
        className='z-0'
        size='lg'
        color='secondary'
        isDisabled={isUpdating}
        isSelected={accent === 'BrE'}
        onValueChange={(v) => {
            startUpdating(async () => {
                setAccent(v ? 'BrE' : 'AmE')
                await setPreference(v)
            })
        }}
        thumbIcon={isUpdating ? <CircularProgress color='secondary' size='sm' /> : accent === 'BrE' ? <PiCoffeeDuotone /> : <PiHamburgerDuotone />}
    >
        <span className={cn(CHINESE_ZCOOL.className, 'text-sm')}>{accent === 'BrE' ? '英式英语' : '美式英语'}</span>
    </Switch>
}
