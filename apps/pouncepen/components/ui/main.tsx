import { cn } from '@heroui/theme'
import type { HTMLAttributes } from 'react'

export default function Main({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <main
            {...props}
            className={cn('w-full sm:w-10/12 px-5 pt-8 pb-24 mx-auto max-w-(--breakpoint-md) min-h-dvh', className)}
        >
            {children}
        </main>
    )
}
