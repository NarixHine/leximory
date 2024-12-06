import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

export default function Main({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <main
            {...props}
            className={cn('w-full px-5 pt-2 mb-20 sm:w-10/12 mx-auto max-w-screen-md', className)}
        >
            {children}
        </main>
    )
}
