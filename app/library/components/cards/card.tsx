import { Skeleton } from "@heroui/skeleton"
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { CircularProgress } from '@heroui/progress'

const GradientCard = ({ text, className, title, children, caption }: {
    title?: string | ReactNode,
    text?: string | ReactNode,
    className?: string,
    children?: ReactNode,
    isLoading?: boolean
    caption?: string | ReactNode
}) => {
    return (
        <div className={cn(
            'h-24',
            className ?? 'bg-linear-to-br from-secondary-50 to-warning-50 dark:from-stone-900 dark:to-stone-700',
            'p-3.5 relative rounded-xl'
        )}>
            {
                title
                    ? <h1 className={'font-fancy opacity-80'}>{title}<span className='text-sm align-baseline'>{caption}</span></h1>
                    : <Skeleton className='h-3 w-1/3 max-w-10 my-1 rounded-lg opacity-50' />
            }
            {
                text
                    ? <div className='opacity-60'>{text}</div>
                    : <Skeleton className='h-2 w-2/3 max-w-30 my-3 rounded-lg opacity-50' />
            }
            <div className='absolute bottom-0 right-0 p-3'>
                {children ?? <CircularProgress
                    value={0}
                    size='lg'
                    color='default'
                    classNames={{
                        track: 'stroke-white/50',
                    }}
                />}
            </div>
        </div>
    )
}

export default GradientCard
