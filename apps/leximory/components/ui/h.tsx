import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

function H({ children, className, disableCenter, fancy }: {
    children: ReactNode,
    className?: string,
    disableCenter?: boolean,
    fancy?: boolean
}) {
    return <h1
        className={cn(
            'text-balance flex',
            !disableCenter && 'justify-center text-center',
            className ?? 'text-5xl',
            fancy ? 'font-fancy' : 'font-formal',
        )}
    ><span className={cn('flex', !disableCenter && 'justify-center text-center')}>{children}</span></h1>
}

export default H
