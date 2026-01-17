import { Switch } from '@heroui/switch'
import { useAtom } from 'jotai'
import { isChatAtom } from './atoms'

export function EditModeSwitch() {
    const [isChat, setIsChat] = useAtom(isChatAtom)

    return (
        <div className='flex justify-end'>
            <Switch
                isSelected={isChat}
                onValueChange={setIsChat}
                color='secondary'
            >
                {isChat ? '自动' : '手动'}
            </Switch>
        </div>
    )
}
