import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

export default function Main({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <main
            {...props}
            className={cn('w-full px-5 py-2 sm:w-10/12 mx-auto max-w-screen-md', 'min-h-[calc(100dvh-200px)]', className)}
        >
            {children}
        </main>
    )
}
