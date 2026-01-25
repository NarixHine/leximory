import { Spinner } from '@heroui/spinner'
import { useLinkStatus } from 'next/link'
import { ReactNode } from 'react'

export function NavIndicator({
    icon,
}: {
    icon: ReactNode
}) {
    const { pending } = useLinkStatus()
    return (<>
        {pending ? (
            <Spinner variant='simple' size='sm' />
        ) : (
            icon
        )}
    </>)
}
