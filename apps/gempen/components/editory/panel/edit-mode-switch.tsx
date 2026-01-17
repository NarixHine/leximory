import { Switch } from '@heroui/switch'
import { useAtom } from 'jotai'
import { isChatAtom } from './atoms'
import { ThemeShinyText } from '@repo/ui/shiny-text'

export function EditModeSwitch() {
    const [isChat, setIsChat] = useAtom(isChatAtom)

    return (
        <div className='flex justify-end'>
            <Switch
                isSelected={isChat}
                onValueChange={setIsChat}
                color='secondary'
                className='flex-row-reverse gap-2'
            >
                {isChat ? <ThemeShinyText className='font-bold' text='Autopilot' /> : 'Edit Mode'}
            </Switch>
        </div>
    )
}
