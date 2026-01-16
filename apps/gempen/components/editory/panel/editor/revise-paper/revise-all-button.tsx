'use client'

import { ProtectedButton } from '@repo/ui/protected-button'
import { BugDroidIcon } from '@phosphor-icons/react'
import { useSetAtom } from 'jotai'
import { reviseAllAtom } from './atoms'

export function ReviseAllButton() {
    const reviseAll = useSetAtom(reviseAllAtom)
    return <ProtectedButton
        onPress={() => reviseAll()}
        startContent={<BugDroidIcon />}
        color='secondary'
        variant='flat'
        size='lg'
    >
        AI 审题
    </ProtectedButton>
}
