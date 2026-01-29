'use client'

import { ProtectedButton } from '@repo/ui/protected-button'
import { BugDroidIcon } from '@phosphor-icons/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { reviseAllAtom } from './atoms'
import { editoryItemsAtom } from '@repo/ui/paper/atoms'

export function ReviseAllButton() {
    const reviseAll = useSetAtom(reviseAllAtom)
    const data = useAtomValue(editoryItemsAtom)
    return <ProtectedButton
        onPress={() => reviseAll()}
        isDisabled={data.length === 0}
        startContent={<BugDroidIcon />}
        color='secondary'
        variant='flat'
        size='lg'
    >
        AI 审题
    </ProtectedButton>
}
