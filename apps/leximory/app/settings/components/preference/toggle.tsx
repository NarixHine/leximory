'use client'

import { CircularProgress, cn, Switch } from "@heroui/react"
import { useState, useTransition } from 'react'
import { setPreference } from '../../actions'
import { Accent } from '@/server/db/preference'
import { PiHamburgerDuotone } from 'react-icons/pi'
import { PiCoffeeDuotone } from 'react-icons/pi'

export default function PreferenceToggle({ accent }: { accent: Accent }) {
    const [isUpdating, startUpdating] = useTransition()
    const [isBrE, setIsBrE] = useState(accent === 'BrE')
    return <Switch
        className='z-0'
        size='lg'
        color='secondary'
        isDisabled={isUpdating}
        isSelected={isBrE}
        onValueChange={(v) => {
            startUpdating(async () => {
                await setPreference(v)
            })
            setIsBrE(v)
        }}
        thumbIcon={isUpdating ? <CircularProgress color='secondary' size='sm' /> : isBrE ? <PiCoffeeDuotone /> : <PiHamburgerDuotone />}
    >
        <span className={cn('text-sm')}>{isBrE ? '英式英语' : '美式英语'}</span>
    </Switch>
}
