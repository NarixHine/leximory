'use client'

import { ReactNode } from 'react'
import { useLinkStatus } from 'next/link'
import { Spinner, SpinnerProps } from '@heroui/spinner'

export default function LoadingIndicatorWrapper({ children, ...props }: { children: ReactNode } & SpinnerProps) {
    const { pending } = useLinkStatus()
    return pending
        ? <Spinner size='sm' {...props} />
        : children
}
