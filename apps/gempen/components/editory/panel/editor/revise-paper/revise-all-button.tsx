'use client'

import { Button } from '@heroui/button'
import { BugDroidIcon } from '@phosphor-icons/react'
import { useSetAtom } from 'jotai'
import { reviseAllAtom } from './atoms'

export function ReviseAllButton() {
    const reviseAll = useSetAtom(reviseAllAtom)
    return <Button
        onPress={() => reviseAll()}
        startContent={<BugDroidIcon />}
        color={'secondary'}
        variant='solid'
        size='lg'
    >
        AI 审题
    </Button>
}
