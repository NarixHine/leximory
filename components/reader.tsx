'use client'

import { isReaderModeAtom } from '@/app/atoms'
import { ReactNode, useEffect } from 'react'
import { useSystemColorMode } from 'react-use-system-color-mode'
import { useAtomValue } from 'jotai'

export default function Reader({ children }: {
    children: ReactNode
}) {
    const isReaderMode = useAtomValue(isReaderModeAtom)
    const colorMode = useSystemColorMode()

    useEffect(() => {
        document.documentElement.style.backgroundColor = isReaderMode
            ? (colorMode === 'dark' ? 'black' : 'white')
            : ''
    }, [isReaderMode, colorMode])

    return children
}
