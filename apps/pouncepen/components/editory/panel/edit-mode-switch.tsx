'use client'

import { Switch } from '@heroui/switch'
import { useAtom } from 'jotai'
import { isChatAtom } from './atoms'
import { ThemeShinyText } from '@repo/ui/shiny-text'
import { SparkleIcon } from '@phosphor-icons/react'

export function EditModeSwitch() {
    const [isChat, setIsChat] = useAtom(isChatAtom)

    return (
        <div className='flex justify-end'>
            <Switch
                isSelected={isChat}
                onValueChange={setIsChat}
                color='secondary'
                className='flex-row-reverse gap-2'
                size='lg'
                thumbIcon={<SparkleIcon weight='duotone' color={isChat ? '#5d5d5c' : '#a3a3a2'} />}
            >
                {isChat ? <ThemeShinyText className='font-formal italic dark:opacity-80' text='PouncePen' /> : <span className='tracking-tight'>Manual Pen</span>}
            </Switch>
        </div>
    )
}
