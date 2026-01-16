import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

export default function Main({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <main
            {...props}
            className={cn('max-w-6xl px-5 pt-10 pb-6 mx-auto min-h-dvh flex flex-col', className)}
        >
            {children}
        </main>
    )
}
