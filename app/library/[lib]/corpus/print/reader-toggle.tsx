'use client'

import { isReaderModeAtom } from '@/app/atoms'
import { Switch } from '@heroui/switch'
import { useAtom } from 'jotai'

export default function ReaderToggle() {
    const [isReaderMode, toggleReaderMode] = useAtom(isReaderModeAtom)
    return <Switch checked={isReaderMode} onValueChange={toggleReaderMode}>
        打印模式
    </Switch>
}
