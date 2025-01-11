'use client'

import { CircularProgress, Switch } from '@nextui-org/react'
import { useAtom } from 'jotai'
import { accentAtom } from '../atoms'
import { PiCoffeeDuotone, PiHamburgerDuotone } from 'react-icons/pi'
import { useTransition } from 'react'
import { setPreference } from '../actions'

export default function Preference() {
    const [accent, setAccent] = useAtom(accentAtom)
    const [isUpdating, startUpdating] = useTransition()
    return <Switch
        isDisabled={isUpdating}
        color='secondary'
        isSelected={accent === 'BrE'}
        onValueChange={(v) => {
            startUpdating(async () => {
                setAccent(v ? 'BrE' : 'AmE')
                await setPreference(v)
            })
        }}
        startContent={<span className='text-2xl'>🇬🇧</span>}
        endContent={<span className='text-2xl'>🇺🇸</span>}
        thumbIcon={isUpdating ? <CircularProgress color='secondary' size='sm' /> : accent === 'BrE' ? <PiCoffeeDuotone /> : <PiHamburgerDuotone />}
    />
}
