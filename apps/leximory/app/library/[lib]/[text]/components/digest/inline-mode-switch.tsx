'use client'

import { Switch } from '@heroui/switch'
import { useAtomValue, useAtom } from 'jotai'
import { PiFileMagnifyingGlassFill, PiFileMagnifyingGlass } from 'react-icons/pi'
import { inlineModeAtom, isLoadingAtom } from '../../atoms'

export function InlineModeSwitch() {
    const [inlineMode, setInlineMode] = useAtom(inlineModeAtom)
    const isLoading = useAtomValue(isLoadingAtom)
    return (<Switch
        size='lg'
        startContent={<PiFileMagnifyingGlassFill />}
        endContent={<PiFileMagnifyingGlass />}
        isDisabled={isLoading}
        isSelected={inlineMode}
        onValueChange={setInlineMode}
        color='secondary'
    />)
}
