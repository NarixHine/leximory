import { ReactNode, HTMLAttributes } from 'react'
import Main from '@/components/ui/main'
import { cn } from '@/lib/utils'

export default function Center({ children, className, ...props }: { children: ReactNode, className?: string } & HTMLAttributes<HTMLDivElement>) {
    return <Main className={cn('flex items-center justify-center mx-auto h-full', className)} {...props}>
        {children}
    </Main>
}
