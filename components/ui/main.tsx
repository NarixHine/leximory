import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

export default function Main({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <main
            {...props}
            className={cn('w-full px-5 pt-10 md:pb-10 pb-24 sm:w-10/12 mx-auto max-w-(--breakpoint-md) min-h-dvh', className)}
        >
            {children}
        </main>
    )
}
